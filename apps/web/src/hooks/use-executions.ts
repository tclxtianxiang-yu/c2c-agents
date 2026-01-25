import type { Agent, Execution } from '@c2c-agents/shared';
import { useCallback, useEffect, useState } from 'react';

type ExecutionWithAgent = Execution & {
  agent: Pick<
    Agent,
    'id' | 'name' | 'supportedTaskTypes' | 'avgRating' | 'completedOrderCount' | 'status'
  > | null;
};

export function useExecutions(
  orderId: string | null,
  userId: string | null,
  pollingInterval = 3000
) {
  const [executions, setExecutions] = useState<ExecutionWithAgent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExecutions = useCallback(async () => {
    if (!orderId || !userId) return;

    try {
      const response = await fetch(`/api/execution/order/${orderId}`, {
        headers: { 'x-user-id': userId },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch executions');
      }

      const data = await response.json();
      setExecutions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [orderId, userId]);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    fetchExecutions().finally(() => setIsLoading(false));
  }, [fetchExecutions]);

  // Polling (only when there are running or pending executions)
  useEffect(() => {
    const hasActiveExecution = executions.some(
      (e) => e.status === 'running' || e.status === 'pending'
    );
    if (!hasActiveExecution || !orderId) return;

    const interval = setInterval(fetchExecutions, pollingInterval);
    return () => clearInterval(interval);
  }, [executions, orderId, pollingInterval, fetchExecutions]);

  return { executions, isLoading, error, refetch: fetchExecutions };
}
