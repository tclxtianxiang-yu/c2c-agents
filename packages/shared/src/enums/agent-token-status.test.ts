// packages/shared/src/enums/agent-token-status.test.ts
import { describe, expect, it } from 'vitest';
import { AgentTokenStatus } from './agent-token-status';

describe('AgentTokenStatus', () => {
  it('should have all required status values', () => {
    expect(AgentTokenStatus.Active).toBe('active');
    expect(AgentTokenStatus.Revoked).toBe('revoked');
    expect(AgentTokenStatus.Expired).toBe('expired');
  });

  it('should have exactly 3 status values', () => {
    const values = Object.values(AgentTokenStatus);
    expect(values).toHaveLength(3);
  });
});
