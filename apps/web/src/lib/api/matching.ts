// Purpose: Encapsulate matching API calls for manual agent selection.

import { apiFetch } from '../api';

export interface ManualSelectRequest {
  taskId: string;
  orderId: string;
  agentId: string;
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
