import type { MastraToken, MastraTokenSummary } from '@c2c-agents/shared';
import { Inject, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

const MASTRA_TOKENS_TABLE = 'mastra_tokens';

type MastraTokenRow = {
  id: string;
  owner_id: string;
  name: string;
  token: string;
  created_at: string;
  updated_at: string;
};

type MastraTokenSummaryRow = {
  id: string;
  name: string;
  created_at: string;
};

export type CreateMastraTokenInput = {
  ownerId: string;
  name: string;
  token: string;
};

export type UpdateMastraTokenInput = {
  name?: string;
  token?: string;
};

function toMastraToken(row: MastraTokenRow): MastraToken {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    token: row.token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMastraTokenSummary(row: MastraTokenSummaryRow): MastraTokenSummary {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  };
}

function ensureNoError(error: unknown, context: string): void {
  if (!error) return;
  let message: string;
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'object' && error !== null && 'message' in error) {
    message = String((error as { message: unknown }).message);
  } else {
    message = JSON.stringify(error);
  }
  throw new Error(`${context}: ${message}`);
}

@Injectable()
export class MastraTokenRepository {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  async create(input: CreateMastraTokenInput): Promise<MastraToken> {
    const { data, error } = await this.supabase
      .query<MastraTokenRow>(MASTRA_TOKENS_TABLE)
      .insert({
        owner_id: input.ownerId,
        name: input.name,
        token: input.token,
      })
      .select('*')
      .single();

    ensureNoError(error, 'Failed to create mastra token');
    if (!data) throw new Error('Failed to create mastra token: empty response');

    return toMastraToken(data);
  }

  async findById(tokenId: string): Promise<MastraToken | null> {
    const { data, error } = await this.supabase
      .query<MastraTokenRow>(MASTRA_TOKENS_TABLE)
      .select('*')
      .eq('id', tokenId)
      .maybeSingle();

    ensureNoError(error, 'Failed to find mastra token by id');
    if (!data) return null;

    return toMastraToken(data);
  }

  async findByOwnerId(ownerId: string): Promise<MastraToken[]> {
    const { data, error } = await this.supabase
      .query<MastraTokenRow>(MASTRA_TOKENS_TABLE)
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    ensureNoError(error, 'Failed to find mastra tokens by owner id');

    return (data ?? []).map(toMastraToken);
  }

  async findSummariesByOwnerId(ownerId: string): Promise<MastraTokenSummary[]> {
    const { data, error } = await this.supabase
      .query<MastraTokenSummaryRow>(MASTRA_TOKENS_TABLE)
      .select('id, name, created_at')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    ensureNoError(error, 'Failed to find mastra token summaries');

    return (data ?? []).map(toMastraTokenSummary);
  }

  async update(tokenId: string, input: UpdateMastraTokenInput): Promise<MastraToken> {
    const updateData: Record<string, string> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.token !== undefined) updateData.token = input.token;

    const { data, error } = await this.supabase
      .query<MastraTokenRow>(MASTRA_TOKENS_TABLE)
      .update(updateData)
      .eq('id', tokenId)
      .select('*')
      .single();

    ensureNoError(error, 'Failed to update mastra token');
    if (!data) throw new Error('Failed to update mastra token: empty response');

    return toMastraToken(data);
  }

  async delete(tokenId: string): Promise<void> {
    const { error } = await this.supabase.query(MASTRA_TOKENS_TABLE).delete().eq('id', tokenId);

    ensureNoError(error, 'Failed to delete mastra token');
  }

  async countByOwnerId(ownerId: string): Promise<number> {
    const { count, error } = await this.supabase
      .query(MASTRA_TOKENS_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', ownerId);

    ensureNoError(error, 'Failed to count mastra tokens');

    return count ?? 0;
  }
}
