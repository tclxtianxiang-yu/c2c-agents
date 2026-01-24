'use client';

import type { MastraTokenSummary } from '@c2c-agents/shared';
import { useCallback, useState } from 'react';
import { apiFetch } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export interface CreateTokenInput {
  name: string;
  token: string;
}

export interface UseListTokensResult {
  tokens: MastraTokenSummary[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface UseCreateTokenResult {
  create: (input: CreateTokenInput) => Promise<MastraTokenSummary>;
  loading: boolean;
  error: string | null;
}

export interface UseDeleteTokenResult {
  deleteToken: (tokenId: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

// ============================================================
// Hooks
// ============================================================

/**
 * Hook to list user's Mastra tokens
 * @param userId - The user ID to fetch tokens for
 */
export function useListTokens(userId: string | undefined): UseListTokensResult {
  const [tokens, setTokens] = useState<MastraTokenSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!userId) {
      setTokens([]);
      return;
    }

    setLoading(true);
    setError(null);

    apiFetch<MastraTokenSummary[]>('/mastra-tokens', {
      headers: {
        'x-user-id': userId,
      },
    })
      .then((data) => {
        setTokens(data);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load tokens');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [userId]);

  return { tokens, loading, error, refetch };
}

/**
 * Hook to create a new Mastra token
 * @param userId - The user ID creating the token
 */
export function useCreateToken(userId: string | undefined): UseCreateTokenResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (input: CreateTokenInput): Promise<MastraTokenSummary> => {
      if (!userId) {
        throw new Error('User ID is required');
      }

      setLoading(true);
      setError(null);

      try {
        const result = await apiFetch<MastraTokenSummary>('/mastra-tokens', {
          method: 'POST',
          headers: {
            'x-user-id': userId,
          },
          body: JSON.stringify(input),
        });
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to create token';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  return { create, loading, error };
}

/**
 * Hook to delete a Mastra token
 * @param userId - The user ID deleting the token
 */
export function useDeleteToken(userId: string | undefined): UseDeleteTokenResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteToken = useCallback(
    async (tokenId: string): Promise<void> => {
      if (!userId) {
        throw new Error('User ID is required');
      }

      setLoading(true);
      setError(null);

      try {
        await apiFetch<void>(`/mastra-tokens/${tokenId}`, {
          method: 'DELETE',
          headers: {
            'x-user-id': userId,
          },
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to delete token';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  return { deleteToken, loading, error };
}
