import { ValidationError } from '@c2c-agents/shared';
import { normalizeAddress } from '@c2c-agents/shared/utils';
import { Inject, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import type { ConnectWalletDto } from './dtos/connect-wallet.dto';

const WALLET_BINDINGS_TABLE = 'wallet_bindings';
const WALLET_EMAIL_DOMAIN = 'wallet.local';

type WalletBindingRow = {
  user_id: string;
  role: 'A' | 'B';
};

@Injectable()
export class AuthService {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  async connectWallet(payload: ConnectWalletDto): Promise<{ userId: string }> {
    const role = payload.role ?? 'A';
    if (role !== 'A' && role !== 'B') {
      throw new ValidationError('role must be A or B');
    }

    const address = payload.address?.trim() ?? '';
    if (!address) {
      throw new ValidationError('address is required');
    }

    let normalized: string;
    try {
      normalized = normalizeAddress(address);
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : 'Invalid address');
    }

    const existing = await this.findActiveBindingByAddress(normalized);
    const userId = existing?.user_id ?? (await this.ensureUserForAddress(normalized));

    await this.ensureRoleBinding(userId, role, normalized);

    return { userId };
  }

  private async findActiveBindingByAddress(address: string): Promise<WalletBindingRow | null> {
    const { data, error } = await this.supabase
      .query<WalletBindingRow>(WALLET_BINDINGS_TABLE)
      .select('user_id, role')
      .ilike('address', address)
      .eq('is_active', true)
      .limit(1);

    if (error) {
      throw new Error(`Failed to fetch wallet binding: ${error.message}`);
    }

    return data?.[0] ?? null;
  }

  private async ensureUserForAddress(address: string): Promise<string> {
    const email = this.buildWalletEmail(address);
    const existingUserId = await this.findUserIdByEmail(email);
    if (existingUserId) return existingUserId;

    const { data, error } = await this.supabase.getClient().auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { walletAddress: address },
    });

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }

    if (!data?.user?.id) {
      throw new Error('Failed to create user: missing user id');
    }

    return data.user.id;
  }

  private async findUserIdByEmail(email: string): Promise<string | null> {
    const client = this.supabase.getClient();
    const perPage = 1000;
    const maxPages = 10;

    for (let page = 1; page <= maxPages; page += 1) {
      const { data, error } = await client.auth.admin.listUsers({ page, perPage });
      if (error) {
        throw new Error(`Failed to fetch user by email: ${error.message}`);
      }

      const match = data.users.find((user) => user.email === email);
      if (match?.id) return match.id;

      if (data.users.length < perPage) break;
    }

    return null;
  }

  private async ensureRoleBinding(userId: string, role: 'A' | 'B', address: string): Promise<void> {
    const { data, error } = await this.supabase
      .query<WalletBindingRow>(WALLET_BINDINGS_TABLE)
      .select('user_id, role')
      .eq('user_id', userId)
      .eq('role', role)
      .eq('is_active', true)
      .limit(1);

    if (error) {
      throw new Error(`Failed to fetch wallet binding for role: ${error.message}`);
    }

    if (data?.length) return;

    const { error: deactivateError } = await this.supabase
      .query(WALLET_BINDINGS_TABLE)
      .update({ is_active: false, deactivated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('role', role)
      .eq('is_active', true);

    if (deactivateError) {
      throw new Error(`Failed to deactivate existing wallet bindings: ${deactivateError.message}`);
    }

    const { error: insertError } = await this.supabase.query(WALLET_BINDINGS_TABLE).insert({
      user_id: userId,
      role,
      address,
      is_active: true,
    });

    if (insertError) {
      throw new Error(`Failed to create wallet binding: ${insertError.message}`);
    }
  }

  private buildWalletEmail(address: string): string {
    const normalized = address.toLowerCase();
    return `wallet_${normalized}@${WALLET_EMAIL_DOMAIN}`;
  }
}
