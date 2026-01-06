import { Injectable } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type SupabaseHealthResult = {
  ok: boolean;
  error?: string;
};

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL ?? '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

    if (!url || !serviceRoleKey) {
      throw new Error('Supabase env missing: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY');
    }

    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  query<T>(table: string): ReturnType<SupabaseClient['from']> {
    return this.client.from<string, T>(table);
  }

  async checkHealth(): Promise<SupabaseHealthResult> {
    const { error } = await this.client
      .from('user_profiles')
      .select('user_id', { head: true, count: 'exact' })
      .limit(1);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  }
}
