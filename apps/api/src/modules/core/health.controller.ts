import { getProvider } from '@c2c-agents/shared/chain';
import { Controller, Get, Inject } from '@nestjs/common';
import { validateApiEnv } from '../../config/env';
import { SupabaseService } from '../../database/supabase.service';

type HealthCheckResult = {
  status: 'ok' | 'error';
  latencyMs: number;
  error?: string;
};

type HealthResponse = {
  status: 'ok' | 'degraded';
  checks: {
    database: HealthCheckResult;
    rpc: HealthCheckResult;
  };
};

const RPC_TIMEOUT_MS = 3000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('RPC timeout')), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

@Controller('api')
export class HealthController {
  constructor(@Inject(SupabaseService) private readonly supabaseService: SupabaseService) {}

  @Get('health')
  async getHealth(): Promise<HealthResponse> {
    const [database, rpc] = await Promise.all([this.checkDatabase(), this.checkRpc()]);

    const status = database.status === 'ok' && rpc.status === 'ok' ? 'ok' : 'degraded';

    return {
      status,
      checks: { database, rpc },
    };
  }

  private async checkDatabase(): Promise<HealthCheckResult> {
    const startedAt = Date.now();
    const result = await this.supabaseService.checkHealth();
    const latencyMs = Date.now() - startedAt;

    if (!result.ok) {
      return { status: 'error', latencyMs, error: result.error };
    }

    return { status: 'ok', latencyMs };
  }

  private async checkRpc(): Promise<HealthCheckResult> {
    const env = validateApiEnv();
    const provider = getProvider({ rpcUrl: env.chainRpcUrl });
    const startedAt = Date.now();

    try {
      await withTimeout(provider.getBlockNumber(), RPC_TIMEOUT_MS);
      const latencyMs = Date.now() - startedAt;
      return { status: 'ok', latencyMs };
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      return {
        status: 'error',
        latencyMs,
        error: error instanceof Error ? error.message : 'RPC check failed',
      };
    }
  }
}
