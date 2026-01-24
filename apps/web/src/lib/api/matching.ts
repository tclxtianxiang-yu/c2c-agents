// Purpose: Encapsulate matching API calls for manual agent selection.

import type { ManualSelectRequest, ManualSelectResponse } from '@c2c-agents/shared';

import { apiFetch } from '../api';

export function manualSelectAgent(payload: ManualSelectRequest) {
  return apiFetch<ManualSelectResponse>('/api/matching/manual-select', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
