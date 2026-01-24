'use client';

import type { MastraTokenSummary } from '@c2c-agents/shared';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@c2c-agents/ui';
import { PlusCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useCreateToken, useListTokens } from '@/hooks/use-mastra-tokens';

// ============================================================
// Types
// ============================================================

export interface TokenSelectorProps {
  userId: string;
  value: string | null;
  onChange: (tokenId: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

// ============================================================
// Add Token Dialog
// ============================================================

interface AddTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (token: MastraTokenSummary) => void;
  userId: string;
}

function AddTokenDialog({ open, onOpenChange, onSuccess, userId }: AddTokenDialogProps) {
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const { create, loading, error } = useCreateToken(userId);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || !token.trim()) return;

      try {
        const newToken = await create({ name: name.trim(), token: token.trim() });
        setName('');
        setToken('');
        onOpenChange(false);
        onSuccess(newToken);
      } catch {
        // Error is handled in the hook
      }
    },
    [name, token, create, onOpenChange, onSuccess]
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setName('');
        setToken('');
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>添加 Mastra Token</DialogTitle>
            <DialogDescription>
              添加您从 Mastra Cloud 获取的 Access Token，用于 Agent 调用鉴权。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="token-name" className="text-sm font-medium">
                名称
              </label>
              <Input
                id="token-name"
                placeholder="例如：生产环境 Token"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="token-value" className="text-sm font-medium">
                Token
              </label>
              <Input
                id="token-value"
                type="password"
                placeholder="粘贴您的 Mastra Access Token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              取消
            </Button>
            <Button type="submit" disabled={loading || !name.trim() || !token.trim()}>
              {loading ? '添加中...' : '添加'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Token Selector Component
// ============================================================

/**
 * A reusable component for selecting a Mastra Token.
 * Displays a dropdown with user's tokens, a "None" option, and an "Add New Token" option.
 */
export function TokenSelector({
  userId,
  value,
  onChange,
  disabled = false,
  placeholder = '选择 Token',
}: TokenSelectorProps) {
  const { tokens, loading, refetch } = useListTokens(userId);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch tokens on mount
  useEffect(() => {
    refetch();
  }, [refetch]);

  const handleValueChange = useCallback(
    (selectedValue: string) => {
      if (selectedValue === '__add_new__') {
        setDialogOpen(true);
        return;
      }

      if (selectedValue === '__none__') {
        onChange(null);
        return;
      }

      onChange(selectedValue);
    },
    [onChange]
  );

  const handleTokenCreated = useCallback(
    (newToken: MastraTokenSummary) => {
      refetch();
      onChange(newToken.id);
    },
    [refetch, onChange]
  );

  // Find selected token name for display
  const selectedToken = tokens.find((t) => t.id === value);
  const displayValue = value ? (selectedToken?.name ?? '未知 Token') : undefined;

  return (
    <>
      <Select
        value={value ?? '__none__'}
        onValueChange={handleValueChange}
        disabled={disabled || loading}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={loading ? '加载中...' : placeholder}>
            {displayValue ?? '无'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">无</SelectItem>
          {tokens.map((token) => (
            <SelectItem key={token.id} value={token.id}>
              {token.name}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value="__add_new__">
            <span className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              添加新 Token
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      <AddTokenDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleTokenCreated}
        userId={userId}
      />
    </>
  );
}
