// Purpose: Encapsulate matching API calls for manual agent selection.

import type { Agent, Order, Task } from '@c2c-agents/shared';

import { apiFetch } from '../api';

export interface ManualSelectRequest {
  taskId: Task['id'];
  orderId: Order['id'];
  agentId: Agent['id'];
}

export interface ManualSelectResponse {
  success: boolean;
  result: 'pairing' | 'queued';
  pairingId?: string;
  queueItemId?: string;
  queuePosition?: number;
}

export function manualSelectAgent(payload: ManualSelectRequest) {
  return apiFetch<ManualSelectResponse>('/api/matching/manual-select', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
