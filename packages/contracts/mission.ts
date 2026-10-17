import { z } from 'zod';

// ============================================================================
// NOEVIX MISSION ARCHITECTURE CONTRACTS (Version 0.1)
// Core Domain Entities: Mission, Plan, Step, Attempt, Event, Artifact, Claim,
// Evidence, Verification, Approval, Budget
// ============================================================================

export const MissionStateSchema = z.enum([
  'created',
  'planning',
  'awaiting_plan_approval',
  'running',
  'verifying',
  'repairing',
  'paused',
  'awaiting_human',
  'completed',
  'failed',
  'cancelled',
]);
export type MissionState = z.infer<typeof MissionStateSchema>;

export const StepKindSchema = z.enum([
  'extract',
  'transform',
  'analyze',
  'generate',
  'verify',
  'synthesize',
]);
export type StepKind = z.infer<typeof StepKindSchema>;

export const StepStateSchema = z.enum([
  'pending',
  'ready',
  'running',
  'produced',
  'verifying',
  'repairing',
  'passed',
  'failed',
  'escalated',
  'human_resolved',
  'abandoned',
]);
export type StepState = z.infer<typeof StepStateSchema>;

export const VerifierTierSchema = z.enum(['V1', 'V2', 'V3', 'V4']);
export type VerifierTier = z.infer<typeof VerifierTierSchema>;

export const VerificationOutcomeSchema = z.enum(['pass', 'fail', 'inconclusive']);
export type VerificationOutcome = z.infer<typeof VerificationOutcomeSchema>;

export const ClaimStatusSchema = z.enum(['verified', 'unsupported', 'contradicted', 'inconclusive']);
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;

export const ToolSideEffectSchema = z.enum(['read', 'write_internal', 'write_external', 'destructive']);
export type ToolSideEffect = z.infer<typeof ToolSideEffectSchema>;

// Budget Specification & Consumption
export const BudgetSchema = z.object({
  tokens: z.number().default(100000),
  seconds: z.number().default(600),
  tool_calls: z.number().default(20),
  usd: z.number().default(2.0),
  consumed: z
    .object({
      tokens: z.number().default(0),
      seconds: z.number().default(0),
      tool_calls: z.number().default(0),
      usd: z.number().default(0),
    })
    .default({ tokens: 0, seconds: 0, tool_calls: 0, usd: 0 }),
});
export type Budget = z.infer<typeof BudgetSchema>;

// Acceptance Criterion
export const AcceptanceCriterionSchema = z.object({
  id: z.string(),
  check: z.string(),
  params: z.record(z.string(), z.any()).optional().default({}),
  passed: z.boolean().optional(),
});
export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;

// Mission Input
export const MissionInputSchema = z.object({
  kind: z.enum(['file', 'dataset', 'url', 'text']),
  ref: z.string(),
  name: z.string().optional(),
  content: z.string().optional(),
});
export type MissionInput = z.infer<typeof MissionInputSchema>;

// Mission Specification
export const MissionSpecSchema = z.object({
  goal: z.string().min(1),
  inputs: z.array(MissionInputSchema).default([]),
  constraints: z.array(z.string()).default([]),
  acceptance: z.array(AcceptanceCriterionSchema).default([]),
  budgets: BudgetSchema.default({
    tokens: 100000,
    seconds: 600,
    tool_calls: 20,
    usd: 2.0,
    consumed: { tokens: 0, seconds: 0, tool_calls: 0, usd: 0 },
  }),
  approvals: z
    .object({
      plan: z.boolean().default(false),
      external_writes: z.boolean().default(true),
      spend_over_usd: z.number().default(1.0),
    })
    .default({
      plan: false,
      external_writes: true,
      spend_over_usd: 1.0,
    }),
  data_policy: z
    .object({
      logging_consent: z.boolean().default(true),
      retention_days: z.number().default(30),
    })
    .default({
      logging_consent: true,
      retention_days: 30,
    }),
});
export type MissionSpec = z.infer<typeof MissionSpecSchema>;

// Step Specification
export const StepSpecSchema = z.object({
  id: z.string(),
  kind: StepKindSchema,
  title: z.string(),
  description: z.string().optional(),
  agent: z.object({
    role: z.enum(['planner', 'executor', 'critic', 'synthesizer', 'summarizer']),
    domain: z.string().optional(),
    tier: z.enum(['small', 'medium', 'large']).default('medium'),
  }),
  inputs: z.object({
    from_steps: z.array(z.string()).default([]),
    artifacts: z.array(z.string()).default([]),
  }),
  tools_allowed: z.array(z.string()).default([]),
  output_schema: z.string().optional(),
  verifiers: z.array(z.string()).default(['schema']),
  policy: z
    .object({
      max_attempts: z.number().default(3),
      timeout_s: z.number().default(300),
      requires_approval: z.boolean().default(false),
    })
    .default({
      max_attempts: 3,
      timeout_s: 300,
      requires_approval: false,
    }),
  idempotency_key: z.string(),
});
export type StepSpec = z.infer<typeof StepSpecSchema>;

// DAG Plan
export const PlanSchema = z.object({
  id: z.string(),
  mission_id: z.string(),
  version: z.number().default(1),
  status: z.enum(['proposed', 'approved', 'rejected', 'superseded']).default('proposed'),
  steps: z.array(StepSpecSchema),
  rationale: z.string().optional(),
  created_at: z.number(),
});
export type Plan = z.infer<typeof PlanSchema>;

// Immutable Artifact
export const ArtifactSchema = z.object({
  hash: z.string(), // SHA-256
  name: z.string(),
  size: z.number(),
  mime: z.string(),
  producer_step: z.string(),
  lineage: z.array(z.string()).default([]),
  content: z.string().optional(),
  created_at: z.number(),
});
export type Artifact = z.infer<typeof ArtifactSchema>;

// Evidence Source
export const EvidenceSchema = z.object({
  id: z.string(),
  kind: z.enum(['source_span', 'tool_run', 'calculation', 'document']),
  ref: z.string(),
  span: z.string().optional(),
  hash: z.string().optional(),
  snippet: z.string(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

// Verified Claim
export const ClaimSchema = z.object({
  id: z.string(),
  text: z.string(),
  artifact_ref: z.string().optional(),
  location: z.string().optional(),
  evidence_ids: z.array(z.string()).default([]),
  status: ClaimStatusSchema.default('inconclusive'),
  detail: z.string().optional(),
});
export type Claim = z.infer<typeof ClaimSchema>;

// Verification Result
export const VerificationSchema = z.object({
  id: z.string(),
  target: z.string(), // step_id or claim_id
  verifier: z.string(),
  tier: VerifierTierSchema.default('V1'),
  outcome: VerificationOutcomeSchema,
  confidence: z.number().optional(),
  detail: z.string(),
  evidence: z.array(EvidenceSchema).optional(),
  repair_hint: z.string().optional(),
  created_at: z.number(),
});
export type Verification = z.infer<typeof VerificationSchema>;

// Human Approval
export const ApprovalSchema = z.object({
  id: z.string(),
  mission_id: z.string(),
  target: z.string(), // plan, step, or tool_call
  type: z.enum(['plan', 'external_write', 'spend_threshold', 'step_escalation']),
  decision: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  user: z.string().optional(),
  note: z.string().optional(),
  requested_at: z.number(),
  decided_at: z.number().optional(),
});
export type Approval = z.infer<typeof ApprovalSchema>;

// Immutable Append-Only Event
export const MissionEventSchema = z.object({
  id: z.string(),
  mission_id: z.string(),
  seq: z.number(),
  type: z.string(),
  payload: z.any(),
  actor: z.string(), // user:id | agent:role | system
  causation: z.string().nullable().optional(),
  prev_hash: z.string(),
  hash: z.string(),
  created_at: z.number(),
});
export type MissionEvent = z.infer<typeof MissionEventSchema>;

// Projected Step State
export const StepViewSchema = z.object({
  id: z.string(),
  spec: StepSpecSchema,
  state: StepStateSchema,
  attempts: z.number().default(0),
  fencing_token: z.number().default(0),
  output: z.any().optional(),
  verifications: z.array(VerificationSchema).default([]),
  repair_count: z.number().default(0),
  started_at: z.number().optional(),
  ended_at: z.number().optional(),
  error: z.string().optional(),
});
export type StepView = z.infer<typeof StepViewSchema>;

// Projected Mission State (Materialized View folded from events)
export const MissionViewSchema = z.object({
  id: z.string(),
  project_id: z.string().default('default'),
  state: MissionStateSchema,
  spec: MissionSpecSchema,
  plan: PlanSchema.nullable(),
  steps: z.record(z.string(), StepViewSchema).default({}),
  artifacts: z.array(ArtifactSchema).default([]),
  claims: z.array(ClaimSchema).default([]),
  verifications: z.array(VerificationSchema).default([]),
  approvals: z.array(ApprovalSchema).default([]),
  budget: BudgetSchema,
  current_step_id: z.string().nullable().optional(),
  deliverable: z
    .object({
      summary: z.string().optional(),
      content: z.string().optional(),
      artifact_hashes: z.array(z.string()).default([]),
      audit_report_hash: z.string().optional(),
    })
    .optional(),
  created_at: z.number(),
  updated_at: z.number(),
});
export type MissionView = z.infer<typeof MissionViewSchema>;

// Audit Report
export const AuditReportSchema = z.object({
  mission_id: z.string(),
  goal: z.string(),
  status: MissionStateSchema,
  created_at: z.number(),
  completed_at: z.number().optional(),
  steps_executed: z.number(),
  verifications_run: z.number(),
  verification_pass_rate: z.number(),
  claims_verified_count: z.number(),
  claims_unverified_count: z.number(),
  budget_consumed: BudgetSchema,
  events_count: z.number(),
  chain_head_hash: z.string(),
  tamper_evident_valid: z.boolean(),
  artifacts: z.array(
    z.object({
      hash: z.string(),
      name: z.string(),
      mime: z.string(),
      producer_step: z.string(),
    })
  ),
  claims: z.array(ClaimSchema),
  approvals: z.array(ApprovalSchema),
});
export type AuditReport = z.infer<typeof AuditReportSchema>;
