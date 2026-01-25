'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

// ============================================================
// Types (matching API response from workbench.repository.ts)
// ============================================================

export type WorkbenchOrder = {
  id: string;
  taskId: string;
  status: string;
  rewardAmount: string;
  providerId: string;
  agentId: string;
  deliveredAt: string | null;
  pairingCreatedAt: string | null;
  createdAt: string;
  task: {
    id: string;
    title: string;
    type: string;
    description: string;
  } | null;
  agent: {
    id: string;
    name: string;
  } | null;
};

export type WorkbenchQueueItem = {
  id: string;
  agentId: string;
  orderId: string;
  status: string;
  createdAt: string;
  order: {
    id: string;
    taskId: string;
    task: {
      id: string;
      title: string;
      type: string;
    } | null;
  } | null;
  agent: {
    id: string;
    name: string;
  } | null;
};

export interface UseWorkbenchOrdersResult {
  orders: WorkbenchOrder[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface UseQueueItemsResult {
  items: WorkbenchQueueItem[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ============================================================
// Internal helper hook
// ============================================================

function useWorkbenchOrders(
  userId: string | undefined,
  endpoint: string
): UseWorkbenchOrdersResult {
  const [orders, setOrders] = useState<WorkbenchOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!userId) {
      setOrders([]);
      return;
    }

    setLoading(true);
    setError(null);

    apiFetch<WorkbenchOrder[]>(endpoint, {
      headers: { 'x-user-id': userId },
    })
      .then((data) => {
        setOrders(data);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch orders');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [userId, endpoint]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { orders, loading, error, refetch };
}

// ============================================================
// Public hooks
// ============================================================

/**
 * Hook to fetch pairing orders (status = 'Pairing')
 * @param userId - The B-side user ID
 */
export function usePairingOrders(userId: string | undefined): UseWorkbenchOrdersResult {
  return useWorkbenchOrders(userId, '/workbench/orders/pairing');
}

/**
 * Hook to fetch in-progress orders (status = 'InProgress')
 * @param userId - The B-side user ID
 */
export function useInProgressOrders(userId: string | undefined): UseWorkbenchOrdersResult {
  return useWorkbenchOrders(userId, '/workbench/orders/in-progress');
}

/**
 * Hook to fetch delivered orders (status = 'Delivered')
 * @param userId - The B-side user ID
 */
export function useDeliveredOrders(userId: string | undefined): UseWorkbenchOrdersResult {
  return useWorkbenchOrders(userId, '/workbench/orders/delivered');
}

/**
 * Hook to fetch history orders (status in 'Paid', 'Refunded', 'Completed')
 * @param userId - The B-side user ID
 */
export function useHistoryOrders(userId: string | undefined): UseWorkbenchOrdersResult {
  return useWorkbenchOrders(userId, '/workbench/orders/history');
}

/**
 * Hook to fetch queue items for B-side user's agents
 * @param userId - The B-side user ID (agent owner)
 */
export function useQueueItems(userId: string | undefined): UseQueueItemsResult {
  const [items, setItems] = useState<WorkbenchQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!userId) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);

    apiFetch<WorkbenchQueueItem[]>('/workbench/queue', {
      headers: { 'x-user-id': userId },
    })
      .then((data) => {
        setItems(data);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch queue');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { items, loading, error, refetch };
}
