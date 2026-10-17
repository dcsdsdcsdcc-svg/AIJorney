import { Router, Request, Response } from 'express';
import {
  ChatRequestSchema,
  FeedbackRequestSchema,
  SPECIALIST_TO_LENS,
  MissionSpecSchema,
} from '../../../packages/contracts/index.ts';
import { executeChatTurn } from '../orchestrator/specialist_runner.ts';
import { Store } from '../storage/store.ts';
import { EventStore } from '../storage/event_store.ts';
import { ArtifactStore } from '../storage/artifact_store.ts';
import { MissionRunner } from '../orchestrator/mission_runner.ts';
import { GlobalRateLimiter } from '../security/rate_limiter.ts';
import { logAudit } from '../security/audit.ts';
import { indexDocument, getIndexedDocuments } from '../tools/retrieval.ts';
import { Telemetry } from '../telemetry/telemetry.ts';
import { getPreRouterStats } from '../orchestrator/pre_router.ts';
import {
  getBackendStatus,
  switchBackend,
  setMockScenario,
  getMockScenario,
} from '../inference/index.ts';
import crypto from 'node:crypto';

export const apiRouter = Router();

// Rate limiting middleware
apiRouter.use((req: Request, res: Response, next) => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const status = GlobalRateLimiter.check(clientIp);

  res.setHeader('X-RateLimit-Remaining', status.remaining);
  if (!status.allowed) {
    res.setHeader('Retry-After', status.retryAfterSeconds);
    logAudit({
      action: 'RATE_LIMIT_EXCEEDED',
      ip: clientIp,
      status: 'blocked',
      details: { retryAfterSeconds: status.retryAfterSeconds },
    });
    return res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: `Too many requests. Please wait ${status.retryAfterSeconds} seconds before retrying.`,
      retry_after_seconds: status.retryAfterSeconds,
    });
  }
  next();
});

// POST /v1/chat (SSE stream)
apiRouter.post('/chat', async (req: Request, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  try {
    const validated = ChatRequestSchema.parse(req.body);

    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    await executeChatTurn(validated, res, clientIp, abortController.signal);
  } catch (err: any) {
    console.error('[API /v1/chat] Validation or handling error:', err);
    if (!res.headersSent) {
      res.status(400).json({ error: 'INVALID_REQUEST', message: err.message });
    }
  }
});

// GET /v1/conversations (and /spaces)
apiRouter.get(['/conversations', '/spaces'], (_req: Request, res: Response) => {
  const convs = Store.getConversations();
  res.json({ conversations: convs, spaces: convs });
});

// GET /v1/conversations/:id (and /spaces/:id)
apiRouter.get(['/conversations/:id', '/spaces/:id'], (req: Request, res: Response) => {
  const conv = Store.getConversation(req.params.id);
  if (!conv) {
    return res.status(404).json({ error: 'SPACE_NOT_FOUND' });
  }
  const messages = Store.getMessagesByConversation(req.params.id);
  res.json({ space: conv, conversation: conv, messages });
});

// DELETE /v1/conversations/:id (and /spaces/:id)
apiRouter.delete(['/conversations/:id', '/spaces/:id'], (req: Request, res: Response) => {
  const ok = Store.deleteConversation(req.params.id);
  res.json({ success: ok });
});

// GET /v1/export/:id (Markdown export)
apiRouter.get('/export/:id', (req: Request, res: Response) => {
  const conv = Store.getConversation(req.params.id);
  if (!conv) {
    return res.status(404).json({ error: 'SPACE_NOT_FOUND' });
  }
  const messages = Store.getMessagesByConversation(req.params.id);
  let md = `# ${conv.title}\n*Exported from Noevix on ${new Date().toISOString()}*\n\n---\n\n`;
  for (const m of messages) {
    if (m.role === 'user') {
      md += `## ${m.content}\n\n`;
    } else {
      md += `${m.content}\n\n*Lens: ${m.lens || 'Reasoning'}*\n\n---\n\n`;
    }
  }
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="noevix-space-${conv.id}.md"`);
  res.send(md);
});

// POST /v1/messages/:id/regenerate
apiRouter.post('/messages/:id/regenerate', async (req: Request, res: Response) => {
  const targetMsg = Store.getMessage(req.params.id);
  if (!targetMsg) {
    return res.status(404).json({ error: 'MESSAGE_NOT_FOUND' });
  }

  // Find user prompt that preceded this message
  let userMsg = targetMsg.role === 'user' ? targetMsg : undefined;
  if (!userMsg && targetMsg.parent_id) {
    userMsg = Store.getMessage(targetMsg.parent_id);
  }

  if (!userMsg) {
    return res.status(400).json({ error: 'CANNOT_FIND_PARENT_USER_MESSAGE' });
  }

  const lensOverride = req.body?.lens_override;
  const chatReq = {
    conversation_id: targetMsg.conversation_id,
    parent_message_id: userMsg.parent_id,
    message: userMsg.content,
    attachments: userMsg.attachments || [],
    lens_override: lensOverride,
  };

  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  await executeChatTurn(chatReq, res, clientIp, abortController.signal);
});

// POST /v1/feedback
apiRouter.post('/feedback', (req: Request, res: Response) => {
  try {
    const validated = FeedbackRequestSchema.parse(req.body);
    const ok = Store.recordFeedback(validated);
    res.json({ success: ok });
  } catch (err: any) {
    res.status(400).json({ error: 'INVALID_FEEDBACK_PAYLOAD', message: err.message });
  }
});

// POST /v1/uploads (File upload validation, chunking, and indexing)
apiRouter.post('/uploads', (req: Request, res: Response) => {
  const { name, content, type } = req.body || {};
  if (!name || typeof content !== 'string') {
    return res.status(400).json({ error: 'MISSING_FILE_NAME_OR_CONTENT' });
  }

  // Cap uploaded text size to 2MB
  if (content.length > 2 * 1024 * 1024) {
    return res.status(413).json({ error: 'FILE_TOO_LARGE', message: 'Uploaded file exceeds 2MB limit.' });
  }

  const id = `doc_${crypto.randomUUID().slice(0, 8)}`;
  const chunks = indexDocument(id, name, content);

  res.json({
    id,
    name,
    size: content.length,
    type: type || 'text/plain',
    chunks_created: chunks.length,
  });
});

// GET /v1/uploads
apiRouter.get('/uploads', (_req: Request, res: Response) => {
  res.json({ documents: getIndexedDocuments() });
});

// GET /v1/preferences and PUT /v1/preferences
apiRouter.get('/preferences', (_req: Request, res: Response) => {
  res.json(Store.getPreferences());
});

apiRouter.put('/preferences', (req: Request, res: Response) => {
  const updated = Store.setPreferences(req.body);
  res.json(updated);
});

// Backend status & Scenario control
apiRouter.get('/backend/status', (_req: Request, res: Response) => {
  res.json({
    ...getBackendStatus(),
    preRouterStats: getPreRouterStats(),
    telemetry: Telemetry.getSummary(),
  });
});

apiRouter.post('/backend/switch', (req: Request, res: Response) => {
  const { backend } = req.body;
  if (!['nim', 'openai', 'gemini', 'mock'].includes(backend)) {
    return res.status(400).json({ error: 'INVALID_BACKEND_NAME' });
  }
  const inst = switchBackend(backend);
  res.json({ success: true, backend: inst.name });
});

apiRouter.post('/backend/scenario', (req: Request, res: Response) => {
  const { scenario } = req.body;
  const valid = ['default', 'fast', 'slow', 'tool_use', 'artifact', 'error', 'rate_limit', 'mid_stream_disconnect'];
  if (!valid.includes(scenario)) {
    return res.status(400).json({ error: 'INVALID_SCENARIO' });
  }
  setMockScenario(scenario);
  res.json({ success: true, activeScenario: getMockScenario() });
});

// Telemetry & Health probes
apiRouter.get('/metrics', (_req: Request, res: Response) => {
  res.json({
    telemetry: Telemetry.getSummary(),
    preRouter: getPreRouterStats(),
    recentTurns: Store.getRecentLogs(20),
  });
});

// Evaluation Harness endpoints
apiRouter.get('/evals/report', async (_req: Request, res: Response) => {
  const { getSavedEvalReport, runEvaluationHarness } = await import('../../../packages/evals/eval_harness.ts');
  let report = getSavedEvalReport();
  if (!report) {
    report = await runEvaluationHarness();
  }
  res.json(report);
});

apiRouter.post('/evals/run', async (_req: Request, res: Response) => {
  const { runEvaluationHarness } = await import('../../../packages/evals/eval_harness.ts');
  const report = await runEvaluationHarness();
  res.json(report);
});

// ============================================================================
// MISSION ARCHITECTURE REST & SSE ENDPOINTS (Section 17)
// ============================================================================

// POST /v1/missions
apiRouter.post('/missions', async (req: Request, res: Response) => {
  try {
    const validated = MissionSpecSchema.parse(req.body);
    const missionId = await MissionRunner.startMission(validated);
    const mission = EventStore.getMission(missionId);
    res.status(201).json({ mission_id: missionId, mission });
  } catch (err: any) {
    res.status(400).json({ error: 'INVALID_MISSION_SPEC', message: err.message });
  }
});

// GET /v1/missions
apiRouter.get('/missions', (_req: Request, res: Response) => {
  res.json({ missions: EventStore.listMissions() });
});

// GET /v1/missions/:id
apiRouter.get('/missions/:id', (req: Request, res: Response) => {
  const mission = EventStore.getMission(req.params.id);
  if (!mission) {
    return res.status(404).json({ error: 'MISSION_NOT_FOUND' });
  }
  res.json({ mission });
});

// GET /v1/missions/:id/stream (SSE)
apiRouter.get('/missions/:id/stream', (req: Request, res: Response) => {
  const missionId = req.params.id;
  const mission = EventStore.getMission(missionId);
  if (!mission) {
    return res.status(404).json({ error: 'MISSION_NOT_FOUND' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Send initial snapshot
  res.write(`event: snapshot\ndata: ${JSON.stringify(mission)}\n\n`);

  // Stream new events
  const unsubscribe = EventStore.subscribe(missionId, (event) => {
    if (!res.writableEnded) {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\nid: ${event.seq}\n\n`);
    }
  });

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': heartbeat\n\n');
    }
  }, 15000);

  res.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// POST /v1/missions/:id/cancel
apiRouter.post('/missions/:id/cancel', (req: Request, res: Response) => {
  const mission = EventStore.getMission(req.params.id);
  if (!mission) {
    return res.status(404).json({ error: 'MISSION_NOT_FOUND' });
  }
  EventStore.appendEvent(req.params.id, 'MissionCancelled', { reason: req.body?.reason || 'User cancelled' }, 'user:client');
  res.json({ success: true, state: 'cancelled' });
});

// POST /v1/missions/:id/resume
apiRouter.post('/missions/:id/resume', (req: Request, res: Response) => {
  const mission = EventStore.getMission(req.params.id);
  if (!mission) {
    return res.status(404).json({ error: 'MISSION_NOT_FOUND' });
  }
  EventStore.appendEvent(req.params.id, 'MissionResumed', { reason: 'User resumed' }, 'user:client');
  MissionRunner.executeMissionDAG(req.params.id).catch((err) => {
    console.error('[MissionRunner] Resume error:', err);
  });
  res.json({ success: true, state: 'running' });
});

// GET /v1/missions/:id/plan
apiRouter.get('/missions/:id/plan', (req: Request, res: Response) => {
  const mission = EventStore.getMission(req.params.id);
  if (!mission || !mission.plan) {
    return res.status(404).json({ error: 'PLAN_NOT_FOUND' });
  }
  res.json({ plan: mission.plan });
});

// PUT /v1/missions/:id/plan (Human Edit)
apiRouter.put('/missions/:id/plan', (req: Request, res: Response) => {
  const mission = EventStore.getMission(req.params.id);
  if (!mission) {
    return res.status(404).json({ error: 'MISSION_NOT_FOUND' });
  }
  EventStore.appendEvent(req.params.id, 'PlanEdited', { plan: req.body.plan, reason: req.body.reason }, 'user:editor');
  res.json({ success: true });
});

// POST /v1/missions/:id/approvals/:approval_id
apiRouter.post('/missions/:id/approvals/:approval_id', (req: Request, res: Response) => {
  const { decision, note } = req.body;
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'INVALID_DECISION' });
  }
  EventStore.appendEvent(req.params.id, 'ApprovalDecided', {
    approval_id: req.params.approval_id,
    decision,
    note,
    user: 'client',
  }, 'user:client');

  if (decision === 'approved') {
    MissionRunner.executeMissionDAG(req.params.id).catch((err) => {
      console.error('[MissionRunner] Execution after approval error:', err);
    });
  }

  res.json({ success: true });
});

// GET /v1/missions/:id/events
apiRouter.get('/missions/:id/events', (req: Request, res: Response) => {
  const afterSeq = Number(req.query.after_seq || '0');
  const events = EventStore.getEvents(req.params.id, afterSeq);
  res.json({ events });
});

// GET /v1/missions/:id/artifacts
apiRouter.get('/missions/:id/artifacts', (req: Request, res: Response) => {
  const mission = EventStore.getMission(req.params.id);
  if (!mission) {
    return res.status(404).json({ error: 'MISSION_NOT_FOUND' });
  }
  res.json({ artifacts: mission.artifacts });
});

// GET /v1/artifacts/:hash
apiRouter.get('/artifacts/:hash', (req: Request, res: Response) => {
  const artifact = ArtifactStore.get(req.params.hash);
  if (!artifact) {
    return res.status(404).json({ error: 'ARTIFACT_NOT_FOUND' });
  }
  res.setHeader('Content-Type', artifact.mime || 'text/plain');
  res.send(artifact.content);
});

// GET /v1/missions/:id/claims
apiRouter.get('/missions/:id/claims', (req: Request, res: Response) => {
  const mission = EventStore.getMission(req.params.id);
  if (!mission) {
    return res.status(404).json({ error: 'MISSION_NOT_FOUND' });
  }
  res.json({ claims: mission.claims });
});

// GET /v1/missions/:id/audit
apiRouter.get('/missions/:id/audit', (req: Request, res: Response) => {
  const audit = EventStore.generateAuditReport(req.params.id);
  if (!audit) {
    return res.status(404).json({ error: 'AUDIT_NOT_FOUND' });
  }
  if (req.query.format === 'markdown') {
    let md = `# Audit Report: Mission ${audit.mission_id}\n\n`;
    md += `**Goal:** ${audit.goal}\n`;
    md += `**Status:** ${audit.status}\n`;
    md += `**Hash Chain Head:** \`${audit.chain_head_hash}\`\n`;
    md += `**Tamper-Evidence Verified:** ${audit.tamper_evident_valid ? 'YES' : 'FAILED'}\n`;
    md += `**Steps Executed:** ${audit.steps_executed} | **Verifications Run:** ${audit.verifications_run} (${Math.round(audit.verification_pass_rate * 100)}% pass rate)\n\n`;
    md += `### Claims Verification\n`;
    for (const c of audit.claims) {
      md += `- [${c.status.toUpperCase()}] "${c.text}" — *${c.detail || ''}*\n`;
    }
    md += `\n### Artifacts Produced\n`;
    for (const a of audit.artifacts) {
      md += `- \`${a.hash.slice(0, 12)}...\` : ${a.name} (${a.mime})\n`;
    }
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    return res.send(md);
  }
  res.json({ audit });
});
