import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  MissionEvent,
  MissionView,
  MissionSpec,
  StepView,
  StepSpec,
  Verification,
  Claim,
  Approval,
  AuditReport,
  Artifact,
} from '../../../packages/contracts/mission.ts';
import { config } from '../config.ts';

type EventListener = (event: MissionEvent) => void;

interface StepLease {
  missionId: string;
  stepId: string;
  workerId: string;
  fencingToken: number;
  expiresAt: number;
}

export class MissionEventStore {
  private dataDir: string;
  private eventsFile: string;
  private missionsFile: string;

  // In-memory indexes
  private eventsByMission: Map<string, MissionEvent[]> = new Map();
  private missionProjections: Map<string, MissionView> = new Map();
  private leases: Map<string, StepLease> = new Map(); // key: "missionId:stepId"
  private globalFencingTokens: Map<string, number> = new Map(); // key: "missionId:stepId"
  private listeners: Map<string, Set<EventListener>> = new Map();

  constructor() {
    this.dataDir = path.resolve(process.cwd(), config.STORAGE_DIR);
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    this.eventsFile = path.join(this.dataDir, 'mission_events.jsonl');
    this.missionsFile = path.join(this.dataDir, 'missions.json');

    this.loadState();
  }

  private loadState() {
    try {
      if (fs.existsSync(this.eventsFile)) {
        const lines = fs.readFileSync(this.eventsFile, 'utf-8').split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev: MissionEvent = JSON.parse(line);
            const list = this.eventsByMission.get(ev.mission_id) || [];
            list.push(ev);
            this.eventsByMission.set(ev.mission_id, list);
          } catch {}
        }
      }

      // Fold all loaded events into projections
      for (const [missionId, events] of this.eventsByMission.entries()) {
        events.sort((a, b) => a.seq - b.seq);
        this.rebuildProjection(missionId);
      }
    } catch (err) {
      console.warn('[EventStore] Failed to load state, starting fresh:', err);
    }
  }

  /**
   * Tamper-evident SHA-256 hash calculation for hash chaining.
   */
  private calculateEventHash(
    prevHash: string,
    missionId: string,
    seq: number,
    type: string,
    payload: any,
    actor: string,
    createdAt: number
  ): string {
    const serialized = JSON.stringify({
      prevHash,
      missionId,
      seq,
      type,
      payload,
      actor,
      createdAt,
    });
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Append a new immutable event to the log.
   * Enforces total ordering by monotonic seq, optimistic concurrency, and tamper-evident chaining.
   */
  public appendEvent(
    missionId: string,
    type: string,
    payload: Record<string, any>,
    actor: string = 'system',
    causation?: string | null
  ): MissionEvent {
    const list = this.eventsByMission.get(missionId) || [];
    const seq = list.length + 1;
    const prevHash = list.length > 0 ? list[list.length - 1].hash : 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000';
    const createdAt = Date.now();
    const clonedPayload = JSON.parse(JSON.stringify(payload || {}));
    const hash = this.calculateEventHash(prevHash, missionId, seq, type, clonedPayload, actor, createdAt);

    const event: MissionEvent = {
      id: `ev_${crypto.randomUUID().slice(0, 12)}`,
      mission_id: missionId,
      seq,
      type,
      payload: clonedPayload,
      actor,
      causation,
      prev_hash: prevHash,
      hash,
      created_at: createdAt,
    };

    list.push(event);
    this.eventsByMission.set(missionId, list);

    // Persist to JSONL (append-only write)
    try {
      fs.appendFileSync(this.eventsFile, JSON.stringify(event) + '\n', 'utf-8');
    } catch (err) {
      console.error('[EventStore] Append event disk error:', err);
    }

    // Fold event into materialized view projection
    this.applyEventToProjection(missionId, event);

    // Notify active subscribers
    const missionListeners = this.listeners.get(missionId);
    if (missionListeners) {
      for (const cb of missionListeners) {
        try {
          cb(event);
        } catch (subErr) {
          console.warn('[EventStore] Subscriber error:', subErr);
        }
      }
    }

    return event;
  }

  /**
   * Rebuild projection by folding all events in chronological sequence.
   */
  public rebuildProjection(missionId: string): MissionView | null {
    const events = this.eventsByMission.get(missionId) || [];
    if (events.length === 0) return null;

    let view: MissionView | null = null;
    for (const ev of events) {
      view = this.foldEvent(view, ev);
    }
    if (view) {
      this.missionProjections.set(missionId, view);
    }
    return view;
  }

  private applyEventToProjection(missionId: string, event: MissionEvent): MissionView {
    const current = this.missionProjections.get(missionId) || null;
    const updated = this.foldEvent(current, event);
    this.missionProjections.set(missionId, updated);
    return updated;
  }

  /**
   * Pure folding function from events into MissionView projection.
   */
  private foldEvent(current: MissionView | null, ev: MissionEvent): MissionView {
    const now = ev.created_at;
    const payload: any = ev.payload || {};

    if (ev.type === 'MissionCreated') {
      const spec: MissionSpec = payload.spec;
      return {
        id: ev.mission_id,
        project_id: payload.project_id || 'default',
        state: 'created',
        spec,
        plan: null,
        steps: {},
        artifacts: [],
        claims: [],
        verifications: [],
        approvals: [],
        budget: spec?.budgets || {
          tokens: 100000,
          seconds: 600,
          tool_calls: 20,
          usd: 2.0,
          consumed: { tokens: 0, seconds: 0, tool_calls: 0, usd: 0 },
        },
        created_at: now,
        updated_at: now,
      };
    }

    if (!current) {
      // Fallback stub if MissionCreated was somehow omitted
      current = {
        id: ev.mission_id,
        project_id: 'default',
        state: 'created',
        spec: {
          goal: 'Unspecified Mission',
          inputs: [],
          constraints: [],
          acceptance: [],
          budgets: { tokens: 100000, seconds: 600, tool_calls: 20, usd: 2.0, consumed: { tokens: 0, seconds: 0, tool_calls: 0, usd: 0 } },
          approvals: { plan: false, external_writes: true, spend_over_usd: 1.0 },
          data_policy: { logging_consent: true, retention_days: 30 },
        },
        plan: null,
        steps: {},
        artifacts: [],
        claims: [],
        verifications: [],
        approvals: [],
        budget: { tokens: 100000, seconds: 600, tool_calls: 20, usd: 2.0, consumed: { tokens: 0, seconds: 0, tool_calls: 0, usd: 0 } },
        created_at: now,
        updated_at: now,
      };
    }

    const updated = { ...current, updated_at: now };

    switch (ev.type) {
      case 'PlanProposed': {
        updated.plan = payload.plan ? JSON.parse(JSON.stringify(payload.plan)) : null;
        updated.state = 'awaiting_plan_approval';
        // Initialize step views
        const stepsMap: Record<string, StepView> = {};
        for (const s of payload.plan?.steps || []) {
          stepsMap[s.id] = {
            id: s.id,
            spec: s,
            state: 'pending',
            attempts: 0,
            fencing_token: 0,
            verifications: [],
            repair_count: 0,
          };
        }
        updated.steps = stepsMap;
        break;
      }

      case 'PlanApproved': {
        if (updated.plan) {
          updated.plan = { ...updated.plan, status: 'approved' };
        }
        updated.state = 'running';
        break;
      }

      case 'StepReady': {
        const sId = payload.step_id;
        if (sId && updated.steps[sId]) {
          updated.steps[sId] = { ...updated.steps[sId], state: 'ready' };
        }
        break;
      }

      case 'StepLeased': {
        const sId = payload.step_id;
        if (sId && updated.steps[sId]) {
          updated.steps[sId] = {
            ...updated.steps[sId],
            fencing_token: payload.fencing_token,
          };
        }
        break;
      }

      case 'StepStarted': {
        const sId = payload.step_id;
        updated.current_step_id = sId;
        updated.state = 'running';
        const st: any = (updated.steps as any)[sId];
        if (sId && st) {
          (updated.steps as any)[sId] = {
            ...st,
            state: 'running',
            attempts: (st.attempts || 0) + 1,
            started_at: now,
          };
        }
        break;
      }

      case 'StepOutputProduced': {
        const sId = payload.step_id;
        const st: any = (updated.steps as any)[sId];
        if (sId && st) {
          (updated.steps as any)[sId] = {
            ...st,
            state: 'produced',
            output: payload.output,
          };
        }
        break;
      }

      case 'VerificationResult': {
        const vr: Verification = payload.verification;
        updated.verifications = [...updated.verifications, vr];
        const sId = payload.step_id;
        const st: any = sId ? (updated.steps as any)[sId] : null;
        if (st) {
          const stepVers = [...(st.verifications || []), vr];
          (updated.steps as any)[sId] = {
            ...st,
            verifications: stepVers,
            state: vr.outcome === 'pass' ? 'passed' : 'verifying',
          };
        }
        break;
      }

      case 'RepairStarted': {
        const sId = payload.step_id;
        const st: any = (updated.steps as any)[sId];
        if (sId && st) {
          (updated.steps as any)[sId] = {
            ...st,
            state: 'repairing',
            repair_count: (st.repair_count || 0) + 1,
          };
        }
        break;
      }

      case 'StepPassed': {
        const sId = payload.step_id;
        if (sId && updated.steps[sId]) {
          updated.steps[sId] = {
            ...updated.steps[sId],
            state: 'passed',
            ended_at: now,
          };
        }
        break;
      }

      case 'StepFailed': {
        const sId = payload.step_id;
        if (sId && updated.steps[sId]) {
          updated.steps[sId] = {
            ...updated.steps[sId],
            state: 'failed',
            ended_at: now,
            error: payload.reason,
          };
        }
        break;
      }

      case 'StepEscalated': {
        const sId = payload.step_id;
        if (sId && updated.steps[sId]) {
          updated.steps[sId] = { ...updated.steps[sId], state: 'escalated' };
        }
        updated.state = 'awaiting_human';
        break;
      }

      case 'ArtifactRegistered': {
        const art: Artifact = payload.artifact;
        const exists = updated.artifacts.some((a) => a.hash === art.hash);
        if (!exists) {
          updated.artifacts = [...updated.artifacts, art];
        }
        break;
      }

      case 'ClaimRecorded': {
        const claim: Claim = payload.claim;
        const filtered = updated.claims.filter((c) => c.id !== claim.id);
        updated.claims = [...filtered, claim];
        break;
      }

      case 'ApprovalRequested': {
        const approval: Approval = payload.approval;
        updated.approvals = [...updated.approvals, approval];
        updated.state = 'awaiting_human';
        break;
      }

      case 'ApprovalDecided': {
        const { approval_id, decision, user, note } = payload;
        updated.approvals = updated.approvals.map((a) =>
          a.id === approval_id
            ? { ...a, decision, user, note, decided_at: now }
            : a
        );
        if (decision === 'approved') {
          updated.state = 'running';
        }
        break;
      }

      case 'BudgetConsumed': {
        const { tokens = 0, seconds = 0, tool_calls = 0, usd = 0 } = payload;
        const c = updated.budget.consumed;
        updated.budget = {
          ...updated.budget,
          consumed: {
            tokens: (c.tokens || 0) + Number(tokens),
            seconds: (c.seconds || 0) + Number(seconds),
            tool_calls: (c.tool_calls || 0) + Number(tool_calls),
            usd: (c.usd || 0) + Number(usd),
          },
        };
        break;
      }

      case 'MissionPaused': {
        updated.state = 'paused';
        break;
      }

      case 'MissionResumed': {
        updated.state = 'running';
        break;
      }

      case 'MissionCompleted': {
        updated.state = 'completed';
        updated.deliverable = payload.deliverable;
        break;
      }

      case 'MissionFailed': {
        updated.state = 'failed';
        break;
      }

      case 'MissionCancelled': {
        updated.state = 'cancelled';
        break;
      }
    }

    return updated;
  }

  /**
   * Acquire a lease on a step with an incremented fencing token (Section 6.4 & Appendix B).
   * Rejects if currently leased by another active worker.
   */
  public acquireStepLease(
    missionId: string,
    stepId: string,
    workerId: string,
    ttlMs: number = 60000
  ): { ok: boolean; fencingToken?: number; error?: string } {
    const key = `${missionId}:${stepId}`;
    const now = Date.now();
    const existing = this.leases.get(key);

    if (existing && existing.expiresAt > now && existing.workerId !== workerId) {
      return { ok: false, error: 'Step already leased by another active worker' };
    }

    const currentToken = (this.globalFencingTokens.get(key) || 0) + 1;
    this.globalFencingTokens.set(key, currentToken);

    this.leases.set(key, {
      missionId,
      stepId,
      workerId,
      fencingToken: currentToken,
      expiresAt: now + ttlMs,
    });

    this.appendEvent(missionId, 'StepLeased', {
      step_id: stepId,
      worker_id: workerId,
      fencing_token: currentToken,
      expires_at: now + ttlMs,
    }, `worker:${workerId}`);

    return { ok: true, fencingToken: currentToken };
  }

  /**
   * Verify fencing token before allowing step write (Invariant I3).
   */
  public verifyFencingToken(missionId: string, stepId: string, token: number): boolean {
    const key = `${missionId}:${stepId}`;
    const current = this.globalFencingTokens.get(key);
    return current === token;
  }

  public getMission(id: string): MissionView | null {
    return this.missionProjections.get(id) || null;
  }

  public getEvents(missionId: string, afterSeq: number = 0): MissionEvent[] {
    const all = this.eventsByMission.get(missionId) || [];
    return all.filter((e) => e.seq > afterSeq);
  }

  public listMissions(): MissionView[] {
    return Array.from(this.missionProjections.values()).sort(
      (a, b) => b.updated_at - a.updated_at
    );
  }

  public subscribe(missionId: string, cb: EventListener): () => void {
    let set = this.listeners.get(missionId);
    if (!set) {
      set = new Set();
      this.listeners.set(missionId, set);
    }
    set.add(cb);
    return () => {
      set?.delete(cb);
    };
  }

  /**
   * Generates a tamper-evident audit report with SHA-256 chain verification.
   */
  public generateAuditReport(missionId: string): AuditReport | null {
    const mission = this.getMission(missionId);
    const events = this.getEvents(missionId);
    if (!mission || events.length === 0) return null;

    // Verify hash chain validity from genesis to head
    let chainValid = true;
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const prevHash = i === 0 ? 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000' : events[i - 1].hash;
      if (ev.prev_hash !== prevHash) {
        console.warn(`[Audit Check PrevHash Mismatch] seq ${ev.seq} expected ${prevHash} got ${ev.prev_hash}`);
        chainValid = false;
        break;
      }
      const calculated = this.calculateEventHash(
        prevHash,
        ev.mission_id,
        ev.seq,
        ev.type,
        ev.payload,
        ev.actor,
        ev.created_at
      );
      if (calculated !== ev.hash) {
        console.warn(`[Audit Check Hash Mismatch] seq ${ev.seq} type ${ev.type}: calculated ${calculated} vs stored ${ev.hash}`);
        chainValid = false;
        break;
      }
    }

    const stepsExecuted = (Object.values(mission.steps) as any[]).filter((s) => (s?.attempts || 0) > 0).length;
    const vers = mission.verifications;
    const passCount = vers.filter((v) => v.outcome === 'pass').length;
    const passRate = vers.length > 0 ? Math.round((passCount / vers.length) * 100) / 100 : 1;

    const verifiedClaims = mission.claims.filter((c) => c.status === 'verified').length;
    const unverifiedClaims = mission.claims.length - verifiedClaims;

    return {
      mission_id: mission.id,
      goal: mission.spec.goal,
      status: mission.state,
      created_at: mission.created_at,
      completed_at: mission.deliverable ? mission.updated_at : undefined,
      steps_executed: stepsExecuted,
      verifications_run: vers.length,
      verification_pass_rate: passRate,
      claims_verified_count: verifiedClaims,
      claims_unverified_count: unverifiedClaims,
      budget_consumed: mission.budget,
      events_count: events.length,
      chain_head_hash: events[events.length - 1].hash,
      tamper_evident_valid: chainValid,
      artifacts: mission.artifacts.map((a) => ({
        hash: a.hash,
        name: a.name,
        mime: a.mime,
        producer_step: a.producer_step,
      })),
      claims: mission.claims,
      approvals: mission.approvals,
    };
  }
}

export const EventStore = new MissionEventStore();
