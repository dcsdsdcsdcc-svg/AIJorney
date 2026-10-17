import { Response } from 'express';
import {
  ChatRequest,
  PublicLens,
  SpecialistId,
  SPECIALIST_TO_LENS,
  LENS_TO_SPECIALIST,
  ArtifactEvent,
  Message,
} from '../../../packages/contracts/index.ts';
import { assemblePrompts } from '../../../packages/prompts/assembler.ts';
import { getInferenceBackend } from '../inference/index.ts';
import { config } from '../config.ts';
import { routeTurn } from './router.ts';
import { runPreRouter } from './pre_router.ts';
import { boundConversationTurns, triggerAsyncSummaryUpdate } from './context_manager.ts';
import { ToolRegistry } from '../tools/registry.ts';
import { Store } from '../storage/store.ts';
import { ArtifactStore } from '../storage/artifact_store.ts';
import { VerifierRegistry } from '../verification/registry.ts';
import { Telemetry, TurnTelemetry } from '../telemetry/telemetry.ts';
import { scanForCanaryLeakage } from '../security/canary.ts';
import crypto from 'node:crypto';

export async function executeChatTurn(
  req: ChatRequest,
  res: Response,
  clientIp?: string,
  abortSignal?: AbortSignal
): Promise<void> {
  const startTime = Date.now();
  let firstTokenTime: number | null = null;
  const turnId = crypto.randomUUID();
  const assistantMessageId = crypto.randomUUID();

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // 15s Heartbeat interval
  const heartbeatTimer = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': heartbeat\n\n');
    }
  }, 15000);

  const cleanup = () => {
    clearInterval(heartbeatTimer);
  };

  const sendEvent = (event: string, data: any) => {
    if (res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // 1. Fetch conversation & history
    let conv = Store.getConversation(req.conversation_id);
    if (!conv) {
      conv = Store.createConversation(req.conversation_id);
    }
    const storedMessages = Store.getMessagesByConversation(req.conversation_id);

    // Save user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      conversation_id: req.conversation_id,
      parent_id: req.parent_message_id || conv.active_leaf_id || null,
      role: 'user',
      content: req.message,
      attachments: req.attachments || [],
      created_at: startTime,
    };
    Store.saveMessage(userMessage);

    const recentTurns = boundConversationTurns(
      storedMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    );

    // 2. Routing Decision (or Lens Override)
    let selectedSpecialist: SpecialistId;
    let secondarySpecialist: SpecialistId | null = null;
    let complexity: 'low' | 'medium' | 'high' = 'low';
    let needsTools: string[] = [];
    let handoffNote = '';
    let t_route = 0;
    let preRouterHit = false;

    if (req.lens_override) {
      // User manual override
      selectedSpecialist = LENS_TO_SPECIALIST[req.lens_override] || 'techne';
      t_route = 0;
      handoffNote = `User explicit lens override: ${req.lens_override}`;
    } else {
      // Heuristic Pre-Router Check
      const preCheck = runPreRouter(req.message);
      preRouterHit = preCheck.hit;

      // Execute Kybernes Router
      const routeResult = await routeTurn(req.message, recentTurns, abortSignal);
      t_route = routeResult.latencyMs;
      selectedSpecialist = routeResult.route.primary;
      secondarySpecialist = routeResult.route.secondary;
      complexity = routeResult.route.complexity;
      needsTools = routeResult.route.needs_tools;
      handoffNote = routeResult.route.handoff_note;
    }

    const publicLens = SPECIALIST_TO_LENS[selectedSpecialist];
    const secondaryLens = secondarySpecialist ? SPECIALIST_TO_LENS[secondarySpecialist] : null;

    // Emit route event
    sendEvent('route', {
      primary: publicLens,
      secondary: secondaryLens,
      complexity,
      pre_router_hit: preRouterHit,
    });

    // 3. Tool Execution if requested
    const toolResults: Array<{ tool: string; output: string }> = [];
    if (needsTools.length > 0) {
      for (const toolName of needsTools) {
        if (abortSignal?.aborted) break;
        sendEvent('tool', { name: toolName, status: 'start' });

        let toolParams: any = { query: req.message };
        if (toolName === 'retrieval') {
          toolParams = {
            query: req.message,
            document_ids: req.attachments?.map((a) => a.id),
          };
        }

        const toolRecord = await ToolRegistry.invoke(toolName, toolParams);
        sendEvent('tool', {
          name: toolName,
          status: toolRecord.status,
          details: toolRecord.status === 'error' ? toolRecord.output : undefined,
        });

        if (toolRecord.status === 'end') {
          toolResults.push({ tool: toolName, output: toolRecord.output });
        }
      }
    }

    // 4. Assemble Prompts (Strict 4-Block ordering)
    const promptAssembly = assemblePrompts(
      selectedSpecialist,
      {
        summary: conv.summary,
        user_preferences: Store.getPreferences() as any,
      },
      {
        handoff_note: handoffNote,
        recent_turns: recentTurns,
        current_message: req.message,
        tool_results: toolResults,
      }
    );

    // 5. Select Model by Complexity
    const targetModel = complexity === 'high' ? config.DEEP_MODEL : config.FAST_MODEL;
    const backend = getInferenceBackend();

    sendEvent('specialist_start', { lens: publicLens });

    // 6. Stream Specialist Inference
    let fullOutputText = '';
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let cachedTokens = 0;

    const stream = backend.streamChat({
      model: targetModel,
      messages: [
        { role: 'system', content: promptAssembly.systemPrompt },
        { role: 'user', content: promptAssembly.userPrompt },
      ],
      temperature: 0.2,
      abortSignal,
    });

    for await (const chunk of stream) {
      if (abortSignal?.aborted) {
        break;
      }

      if (!firstTokenTime) {
        firstTokenTime = Date.now();
      }

      if (chunk.text) {
        fullOutputText += chunk.text;
        sendEvent('token', { text: chunk.text });
      }

      if (chunk.usage) {
        totalPromptTokens = chunk.usage.prompt_tokens;
        totalCompletionTokens = chunk.usage.completion_tokens;
        cachedTokens = chunk.usage.cached_tokens || 0;
      }
    }

    sendEvent('specialist_end', { lens: publicLens });

    // 7. Canary Security Check
    const canaryResult = scanForCanaryLeakage(fullOutputText, clientIp);
    if (canaryResult.leaked) {
      fullOutputText = canaryResult.sanitizedText;
    }

    // 8. Artifact Extraction (Extract fenced code or documents) & Content-Addressed Store
    const artifacts: ArtifactEvent[] = [];
    const codeBlockRegex = /```([a-zA-Z0-9_\-]+)?\n([\s\S]*?)```/g;
    let match;
    let artIdx = 1;
    while ((match = codeBlockRegex.exec(fullOutputText)) !== null) {
      const lang = match[1] || 'text';
      const code = match[2];
      const isHtmlOrComponent = ['html', 'tsx', 'jsx', 'svg'].includes(lang.toLowerCase());
      const type = isHtmlOrComponent ? 'preview' : 'code';
      const artId = `art_${turnId}_${artIdx++}`;
      const title = `${lang.toUpperCase()} Implementation`;

      // Persist in Content-Addressed Store (SHA-256)
      const storedBlob = ArtifactStore.put(
        `${title.toLowerCase().replace(/\s+/g, '_')}.${lang}`,
        code,
        isHtmlOrComponent ? 'text/html' : 'text/plain',
        selectedSpecialist
      );

      const artEvent: ArtifactEvent = {
        id: artId,
        type,
        title,
        language: lang,
        content: code,
        done: true,
      };
      artifacts.push(artEvent);
      sendEvent('artifact', { ...artEvent, hash: storedBlob.hash });
    }

    // 8b. Verification Plane: Run verifiers & extract grounded claims
    const stepSpecStub = {
      id: `chat_turn_${turnId}`,
      kind: 'generate' as const,
      title: `${publicLens} Synthesis`,
      agent: { role: 'executor' as const, domain: selectedSpecialist, tier: 'medium' as const },
      inputs: { from_steps: [], artifacts: [] },
      tools_allowed: needsTools,
      verifiers: ['v1.schema.validation', 'v1.code.syntax', 'v4.critic.rubric'],
      policy: { max_attempts: 1, timeout_s: 30, requires_approval: false },
      idempotency_key: turnId,
    };
    const verifications = await VerifierRegistry.verifyStep(stepSpecStub, fullOutputText);
    for (const v of verifications) {
      sendEvent('verification', v);
    }

    const claims = VerifierRegistry.extractAndVerifyClaims(fullOutputText, []);
    if (claims.length > 0) {
      sendEvent('claims', { claims });
    }

    const t_total = Date.now() - startTime;
    const t_first_token = firstTokenTime ? firstTokenTime - startTime : t_total;

    // 9. Save Assistant Message
    const assistantMessage: Message = {
      id: assistantMessageId,
      conversation_id: req.conversation_id,
      parent_id: userMessage.id,
      role: 'assistant',
      content: fullOutputText,
      lens: publicLens,
      artifacts,
      created_at: Date.now(),
      usage: {
        tokens_in: totalPromptTokens || Math.round(promptAssembly.userPrompt.length / 4),
        tokens_out: totalCompletionTokens || Math.round(fullOutputText.length / 4),
        cached_tokens: cachedTokens,
        ms_total: t_total,
        ms_first_token: t_first_token,
        t_route,
      },
    };
    Store.saveMessage(assistantMessage);

    // 10. Record Telemetry & Logging (Gated by user consent)
    const telemetryRecord: TurnTelemetry = {
      turnId,
      t_route,
      t_first_token,
      t_total,
      tokens_in: assistantMessage.usage!.tokens_in,
      tokens_out: assistantMessage.usage!.tokens_out,
      cached_tokens: cachedTokens,
      pre_router_hit: preRouterHit,
      specialist: selectedSpecialist,
      spans: [
        { name: 'route', startTime, durationMs: t_route },
        { name: 'specialist_stream', startTime: startTime + t_route, durationMs: t_total - t_route },
      ],
    };
    Telemetry.recordTurn(telemetryRecord);

    Store.logTurn({
      id: turnId,
      timestamp: startTime,
      conversation_id: req.conversation_id,
      message_id: assistantMessageId,
      route: {
        primary: selectedSpecialist,
        secondary: secondarySpecialist,
        complexity,
        fromPreRouter: preRouterHit,
      },
      metrics: {
        t_route,
        t_first_token,
        t_total,
        tokens_in: assistantMessage.usage!.tokens_in,
        tokens_out: assistantMessage.usage!.tokens_out,
        cached_tokens: cachedTokens,
      },
      user_input: req.message,
      output: fullOutputText,
    });

    // 11. Trigger Async Background Summary Update
    triggerAsyncSummaryUpdate(
      conv.summary,
      [
        ...recentTurns,
        { role: 'user', content: req.message },
        { role: 'assistant', content: fullOutputText },
      ],
      (newSummary) => {
        Store.updateConversation(req.conversation_id, { summary: newSummary });
      }
    );

    // 12. Send Done Event
    sendEvent('done', {
      usage: assistantMessage.usage,
      message_id: assistantMessageId,
      parent_id: userMessage.id,
    });
  } catch (err: any) {
    console.error('[Orchestration] Turn error:', err);
    Telemetry.recordError(err.code || 'INFERENCE_ERROR');
    sendEvent('error', {
      code: err.code || 'STREAM_ERROR',
      message: err.message || 'An error occurred during response orchestration.',
      retryable: err.status === 429 || err.code === 'UPSTREAM_TIMEOUT',
    });
  } finally {
    cleanup();
    if (!res.writableEnded) {
      res.end();
    }
  }
}
