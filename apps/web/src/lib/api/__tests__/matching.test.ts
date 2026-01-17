// Purpose: Validate matching API type shapes for manual selection.

import { describe, expect, it } from 'vitest';

import type { ManualSelectRequest } from '../matching';

describe('matching API types', () => {
  it('should have correct request shape', () => {
    const request: ManualSelectRequest = {
      taskId: 'uuid',
      orderId: 'uuid',
      agentId: 'uuid',
    };

    expect(request).toBeDefined();
  });
});
