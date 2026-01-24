'use client';

import type { MastraTokenSummary } from '@c2c-agents/shared';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@c2c-agents/ui';
import { useCallback, useEffect, useState } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { useCreateToken, useDeleteToken, useListTokens } from '@/hooks/use-mastra-tokens';
import { useUserId } from '@/lib/useUserId';

// ============================================================
// Helper Functions
// ============================================================

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================================
// Create Token Dialog
// ============================================================

interface CreateTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  userId: string | undefined;
}

function CreateTokenDialog({ open, onOpenChange, onSuccess, userId }: CreateTokenDialogProps) {
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const { create, loading } = useCreateToken(userId);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || !token.trim()) return;

      try {
        await create({ name: name.trim(), token: token.trim() });
        setName('');
        setToken('');
        onOpenChange(false);
        onSuccess();
      } catch {
        // Error is handled in the hook
      }
    },
    [name, token, create, onOpenChange, onSuccess]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              <label htmlFor="name" className="text-sm font-medium">
                名称
              </label>
              <Input
                id="name"
                placeholder="例如：生产环境 Token"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="token" className="text-sm font-medium">
                Token
              </label>
              <Input
                id="token"
                type="password"
                placeholder="粘贴您的 Mastra Access Token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
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
// Delete Token Dialog
// ============================================================

interface DeleteTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  tokenName: string;
  loading: boolean;
}

function DeleteTokenDialog({
  open,
  onOpenChange,
  onConfirm,
  tokenName,
  loading,
}: DeleteTokenDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>
            您确定要删除 Token "{tokenName}" 吗？此操作无法撤销，关联此 Token 的 Agent
            将无法正常工作。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            取消
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? '删除中...' : '确认删除'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Token Table
// ============================================================

interface TokenTableProps {
  tokens: MastraTokenSummary[];
  onDelete: (token: MastraTokenSummary) => void;
}

function TokenTable({ tokens, onDelete }: TokenTableProps) {
  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">暂无 Token</p>
        <p className="text-sm text-muted-foreground mt-1">
          点击上方"添加 Token"按钮添加您的第一个 Mastra Access Token
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>名称</TableHead>
          <TableHead>创建时间</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tokens.map((token) => (
          <TableRow key={token.id}>
            <TableCell className="font-medium">{token.name}</TableCell>
            <TableCell>{formatDate(token.createdAt)}</TableCell>
            <TableCell className="text-right">
              <Button variant="destructive" size="sm" onClick={() => onDelete(token)}>
                删除
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ============================================================
// Main Page Component
// ============================================================

export default function TokensPage() {
  const { userId } = useUserId('B');

  const { tokens, loading, error, refetch } = useListTokens(userId);
  const { deleteToken, loading: deleteLoading } = useDeleteToken(userId);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tokenToDelete, setTokenToDelete] = useState<MastraTokenSummary | null>(null);

  // Fetch tokens on mount and when userId changes
  useEffect(() => {
    refetch();
  }, [refetch]);

  const handleDeleteClick = useCallback((token: MastraTokenSummary) => {
    setTokenToDelete(token);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!tokenToDelete) return;

    try {
      await deleteToken(tokenToDelete.id);
      setDeleteDialogOpen(false);
      setTokenToDelete(null);
      refetch();
    } catch {
      // Error is handled in the hook
    }
  }, [tokenToDelete, deleteToken, refetch]);

  const handleCreateSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopNav />

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle>Mastra Access Tokens</CardTitle>
              <CardDescription className="mt-1.5">
                管理您的 Mastra Cloud Access Tokens，用于 Agent 调用鉴权
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} disabled={!userId}>
              添加 Token
            </Button>
          </CardHeader>
          <CardContent>
            {!userId && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">请先连接钱包</p>
              </div>
            )}

            {userId && loading && (
              <div className="flex items-center justify-center py-12">
                <output className="text-center text-muted-foreground">加载中...</output>
              </div>
            )}

            {userId && error && (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="text-center text-destructive">{error}</div>
                <Button variant="outline" onClick={refetch}>
                  重试
                </Button>
              </div>
            )}

            {userId && !loading && !error && (
              <TokenTable tokens={tokens} onDelete={handleDeleteClick} />
            )}
          </CardContent>
        </Card>
      </div>

      <CreateTokenDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
        userId={userId}
      />

      <DeleteTokenDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        tokenName={tokenToDelete?.name ?? ''}
        loading={deleteLoading}
      />
    </main>
  );
}
