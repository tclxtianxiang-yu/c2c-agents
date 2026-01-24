import { describe, expect, it } from 'vitest';
import {
  generateAgentToken,
  getTokenPrefix,
  hashAgentToken,
  isValidAgentTokenFormat,
} from './agent-token';

describe('generateAgentToken', () => {
  it('should generate a 48-character token', () => {
    const token = generateAgentToken();
    expect(token).toHaveLength(48);
  });

  it('should start with cagt_ prefix', () => {
    const token = generateAgentToken();
    expect(token.startsWith('cagt_')).toBe(true);
  });

  it('should generate unique tokens', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateAgentToken());
    }
    expect(tokens.size).toBe(100);
  });

  it('should only contain valid base64url characters after prefix', () => {
    const token = generateAgentToken();
    const suffix = token.slice(5);
    expect(/^[A-Za-z0-9_-]+$/.test(suffix)).toBe(true);
  });
});

describe('hashAgentToken', () => {
  it('should return a 64-character hex string', () => {
    const token = 'cagt_abcdef123456789012345678901234567890123';
    const hash = hashAgentToken(token);
    expect(hash).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
  });

  it('should produce consistent hash for same input', () => {
    const token = 'cagt_test123456789012345678901234567890123456';
    const hash1 = hashAgentToken(token);
    const hash2 = hashAgentToken(token);
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different inputs', () => {
    const token1 = 'cagt_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const token2 = 'cagt_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    expect(hashAgentToken(token1)).not.toBe(hashAgentToken(token2));
  });
});

describe('getTokenPrefix', () => {
  it('should return first 17 characters', () => {
    const token = 'cagt_abcdef123456789012345678901234567890123';
    const prefix = getTokenPrefix(token);
    expect(prefix).toBe('cagt_abcdef123456');
    expect(prefix).toHaveLength(17);
  });
});

describe('isValidAgentTokenFormat', () => {
  it('should return true for valid tokens', () => {
    const token = generateAgentToken();
    expect(isValidAgentTokenFormat(token)).toBe(true);
  });

  it('should return false for tokens without cagt_ prefix', () => {
    expect(isValidAgentTokenFormat('abcd_123456789012345678901234567890123')).toBe(false);
  });

  it('should return false for tokens with wrong length', () => {
    expect(isValidAgentTokenFormat('cagt_tooshort')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isValidAgentTokenFormat('')).toBe(false);
  });
});
