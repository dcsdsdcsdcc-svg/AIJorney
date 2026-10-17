import { z } from 'zod';

export const SpecialistIdSchema = z.enum([
  'techne',
  'morphe',
  'gnosis',
  'logos',
  'rhetor',
]);
export type SpecialistId = z.infer<typeof SpecialistIdSchema>;

export const PublicLensSchema = z.enum([
  'Engineering',
  'Design',
  'Research',
  'Reasoning',
  'Writing',
]);
export type PublicLens = z.infer<typeof PublicLensSchema>;

export const SPECIALIST_TO_LENS: Record<SpecialistId, PublicLens> = {
  techne: 'Engineering',
  morphe: 'Design',
  gnosis: 'Research',
  logos: 'Reasoning',
  rhetor: 'Writing',
};

export const LENS_TO_SPECIALIST: Record<PublicLens, SpecialistId> = {
  Engineering: 'techne',
  Design: 'morphe',
  Research: 'gnosis',
  Reasoning: 'logos',
  Writing: 'rhetor',
};

export const LENS_DESCRIPTIONS: Record<PublicLens, string> = {
  Engineering: 'Architecture, systems, code generation, and debugging',
  Design: 'Design tokens, layout hierarchy, UX specifications, and UI components',
  Research: 'Fact synthesis, claim-level sourcing, and empirical verification',
  Reasoning: 'Formal logic, decision frameworks, mathematics, and derivations',
  Writing: 'Concise editorial craft, document structure, and tone calibration',
};

export const ComplexitySchema = z.enum(['low', 'medium', 'high']);
export type Complexity = z.infer<typeof ComplexitySchema>;

export const ToolNameSchema = z.enum(['search', 'code_exec', 'retrieval']);
export type ToolName = z.infer<typeof ToolNameSchema>;

export const RouterOutputSchema = z.object({
  primary: SpecialistIdSchema,
  secondary: SpecialistIdSchema.nullable().default(null),
  parallel: z.boolean().default(false),
  complexity: ComplexitySchema.default('low'),
  needs_tools: z.array(ToolNameSchema).default([]),
  handoff_note: z.string().max(160).default(''),
});
export type RouterOutput = z.infer<typeof RouterOutputSchema>;

export const AttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number(),
  type: z.string(),
  url: z.string().optional(),
  content: z.string().optional(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const ChatRequestSchema = z.object({
  conversation_id: z.string(),
  parent_message_id: z.string().nullable().optional(),
  message: z.string().min(1),
  attachments: z.array(AttachmentSchema).optional().default([]),
  lens_override: PublicLensSchema.optional(),
  stream: z.boolean().optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// SSE Event Payloads
export const RouteEventSchema = z.object({
  primary: PublicLensSchema,
  secondary: PublicLensSchema.nullable().optional(),
  complexity: ComplexitySchema,
  pre_router_hit: z.boolean().optional(),
});
export type RouteEvent = z.infer<typeof RouteEventSchema>;

export const SpecialistStartEventSchema = z.object({
  lens: PublicLensSchema,
});
export type SpecialistStartEvent = z.infer<typeof SpecialistStartEventSchema>;

export const TokenEventSchema = z.object({
  text: z.string(),
});
export type TokenEvent = z.infer<typeof TokenEventSchema>;

export const ToolEventSchema = z.object({
  name: z.string(),
  status: z.enum(['start', 'end', 'error']),
  details: z.string().optional(),
});
export type ToolEvent = z.infer<typeof ToolEventSchema>;

export const ArtifactTypeSchema = z.enum(['code', 'document', 'preview', 'diff']);
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

export const ArtifactEventSchema = z.object({
  id: z.string(),
  type: ArtifactTypeSchema,
  title: z.string(),
  language: z.string().optional(),
  content_delta: z.string().optional(),
  content: z.string().optional(),
  done: z.boolean(),
});
export type ArtifactEvent = z.infer<typeof ArtifactEventSchema>;

export const SpecialistEndEventSchema = z.object({
  lens: PublicLensSchema,
});
export type SpecialistEndEvent = z.infer<typeof SpecialistEndEventSchema>;

export const ErrorEventSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean().default(false),
});
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;

export const DoneEventSchema = z.object({
  usage: z.object({
    tokens_in: z.number().default(0),
    tokens_out: z.number().default(0),
    cached_tokens: z.number().default(0),
    ms_total: z.number().default(0),
    ms_first_token: z.number().default(0),
    t_route: z.number().default(0),
  }),
  message_id: z.string(),
  parent_id: z.string().nullable().optional(),
});
export type DoneEvent = z.infer<typeof DoneEventSchema>;

// Tree Node Message Schema
export const MessageSchema = z.object({
  id: z.string(),
  conversation_id: z.string(),
  parent_id: z.string().nullable(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  lens: PublicLensSchema.optional(),
  attachments: z.array(AttachmentSchema).optional(),
  artifacts: z.array(ArtifactEventSchema).optional(),
  created_at: z.number(),
  usage: z
    .object({
      tokens_in: z.number(),
      tokens_out: z.number(),
      cached_tokens: z.number(),
      ms_total: z.number(),
      ms_first_token: z.number(),
      t_route: z.number().optional(),
    })
    .optional(),
  feedback: z
    .object({
      rating: z.enum(['positive', 'negative']),
      correct_lens: PublicLensSchema.optional(),
      comment: z.string().optional(),
      timestamp: z.number(),
    })
    .optional(),
});
export type Message = z.infer<typeof MessageSchema>;

export const ConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  created_at: z.number(),
  updated_at: z.number(),
  root_message_id: z.string().nullable().optional(),
  active_leaf_id: z.string().nullable().optional(),
  summary: z.string().optional(),
  archived: z.boolean().optional().default(false),
  project_id: z.string().optional(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const FeedbackRequestSchema = z.object({
  message_id: z.string(),
  rating: z.enum(['positive', 'negative']),
  correct_lens: PublicLensSchema.optional(),
  comment: z.string().optional(),
});
export type FeedbackRequest = z.infer<typeof FeedbackRequestSchema>;

export * from './mission.ts';
