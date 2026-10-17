import { Budget } from '../../../packages/contracts/mission.ts';
import { EventStore } from '../storage/event_store.ts';

export interface PreCallReservation {
  reservationId: string;
  missionId: string;
  estimatedTokens: number;
  estimatedSeconds: number;
  estimatedToolCalls: number;
  estimatedUsd: number;
}

export class BudgetGovernor {
  /**
   * Pre-call check & reservation (Principle P7: Hard budgets).
   * Checks whether the mission has enough remaining budget before initiating a model or tool call.
   */
  public static canExecute(
    missionId: string,
    estimatedTokens: number = 2000,
    estimatedSeconds: number = 30,
    estimatedToolCalls: number = 1
  ): { allowed: boolean; reason?: string } {
    const mission = EventStore.getMission(missionId);
    if (!mission) {
      return { allowed: false, reason: 'Mission not found' };
    }

    const { budget } = mission;
    const consumed = budget.consumed;

    if (consumed.tokens + estimatedTokens > budget.tokens) {
      this.pauseMissionForBudget(missionId, 'Token budget exhausted');
      return { allowed: false, reason: `Token budget limit exceeded (${budget.tokens} tokens)` };
    }

    if (consumed.seconds + estimatedSeconds > budget.seconds) {
      this.pauseMissionForBudget(missionId, 'Time limit exhausted');
      return { allowed: false, reason: `Execution time limit exceeded (${budget.seconds}s)` };
    }

    if (consumed.tool_calls + estimatedToolCalls > budget.tool_calls) {
      this.pauseMissionForBudget(missionId, 'Tool call budget exhausted');
      return { allowed: false, reason: `Tool call limit exceeded (${budget.tool_calls} calls)` };
    }

    // 80% Warning check
    const tokenBurnRatio = (consumed.tokens + estimatedTokens) / budget.tokens;
    if (tokenBurnRatio >= 0.8 && tokenBurnRatio < 0.95) {
      EventStore.appendEvent(missionId, 'BudgetWarning', {
        type: 'token_warning',
        percent: Math.round(tokenBurnRatio * 100),
        consumed: consumed.tokens,
        limit: budget.tokens,
      }, 'governor');
    }

    return { allowed: true };
  }

  /**
   * Reconciles actual consumption after call completion.
   */
  public static recordConsumption(
    missionId: string,
    actual: {
      tokens?: number;
      seconds?: number;
      tool_calls?: number;
      usd?: number;
    }
  ): void {
    const tokens = actual.tokens || 0;
    const seconds = actual.seconds || 0;
    const toolCalls = actual.tool_calls || 0;
    // Calculate approximate USD: $0.15 / 1M tokens approx for flash models
    const usd = actual.usd !== undefined ? actual.usd : Math.round((tokens / 1000000) * 0.15 * 1000) / 1000;

    EventStore.appendEvent(missionId, 'BudgetConsumed', {
      tokens,
      seconds,
      tool_calls: toolCalls,
      usd,
    }, 'governor');
  }

  private static pauseMissionForBudget(missionId: string, reason: string) {
    EventStore.appendEvent(missionId, 'BudgetExhausted', { reason }, 'governor');
    EventStore.appendEvent(missionId, 'MissionPaused', { reason: `Paused: ${reason}` }, 'governor');
  }
}
