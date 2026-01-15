'use client';

import { getEscrowAddress, getMockUSDTContract } from '@c2c-agents/shared/chain';
import { toMinUnit } from '@c2c-agents/shared/utils';
import { BrowserProvider } from 'ethers';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useUserId } from '../../lib/useUserId';
import { PaymentStatusBanner } from '../tasks/PaymentStatusBanner';

const USDT_DECIMALS = 6;
const PLATFORM_FEE_RATE = 0.15;

type CreateTaskResponse = {
  id: string;
  status: string;
};

type ConfirmResponse = {
  taskId: string;
  orderId: string;
  status: string;
  confirmations: number;
};

function formatAmount(value: string): string {
  const parsed = Number(value || '0');
  if (Number.isNaN(parsed)) return '0';
  return Math.floor(parsed).toLocaleString();
}

type CreateTaskFormProps = {
  onClose?: () => void;
  onSuccess?: () => void;
};

export function CreateTaskForm({ onClose, onSuccess }: CreateTaskFormProps) {
  const { userId, isConnected } = useUserId('A');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('website');
  const [tags, setTags] = useState('');
  const [promptData, setPromptData] = useState('');
  const [attachments, setAttachments] = useState('');
  const [reward, setReward] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [txHash, setTxHash] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'error'>(
    'idle'
  );
  const [paymentMessage, setPaymentMessage] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const tagList = useMemo(
    () =>
      tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tags]
  );

  const rewardAmount = formatAmount(reward);
  const feeAmount = formatAmount(String(Number(reward || '0') * PLATFORM_FEE_RATE));
  const totalAmount = formatAmount(String(Number(reward || '0') * (1 + PLATFORM_FEE_RATE)));

  const finalizeSuccess = () => {
    if (onSuccess) {
      onSuccess();
      return;
    }
    onClose?.();
  };

  const confirmPayment = async (taskIdValue: string, payTxHash: string) => {
    const response = await apiFetch<ConfirmResponse>(`/tasks/${taskIdValue}/payments/confirm`, {
      method: 'POST',
      headers: {
        'x-user-id': userId,
      },
      body: JSON.stringify({
        payTxHash,
      }),
    });

    setPaymentStatus('success');
    setPaymentMessage(`确认数 ${response.confirmations}`);
    finalizeSuccess();
  };

  const executeWalletPayment = async (amount: string) => {
    const ethereum = (window as Window & { ethereum?: unknown }).ethereum;
    if (!ethereum) {
      throw new Error('未检测到钱包，请先安装并连接钱包');
    }

    const provider = new BrowserProvider(ethereum as never);
    const signer = await provider.getSigner();
    const mockUsdt = getMockUSDTContract({ signer });
    const escrowAddress = getEscrowAddress();
    const tx = await mockUsdt.transfer(escrowAddress, BigInt(amount));

    setPaymentMessage('交易已提交，等待确认...');
    const receipt = await tx.wait(1);
    if (!receipt || receipt.status !== 1) {
      throw new Error('交易失败，请在钱包或区块浏览器确认');
    }

    return tx.hash;
  };

  const handleCreate = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const expectedReward = toMinUnit(reward || '0', USDT_DECIMALS);
      setPaymentStatus('pending');
      setPaymentMessage('等待钱包确认支付...');
      const response = await apiFetch<CreateTaskResponse>('/tasks', {
        method: 'POST',
        headers: {
          'x-user-id': userId,
        },
        body: JSON.stringify({
          title,
          description,
          type,
          tags: tagList,
          attachments: attachments
            .split(',')
            .map((file) => file.trim())
            .filter(Boolean),
          expectedReward,
        }),
      });
      setTaskId(response.id);
      const hash = await executeWalletPayment(expectedReward);
      setTxHash(hash);
      await confirmPayment(response.id, hash);
    } catch (error) {
      setPaymentStatus('error');
      setPaymentMessage(error instanceof Error ? error.message : '创建任务失败');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!taskId || !userId) return;
    setPaymentStatus('pending');
    setPaymentMessage(undefined);
    try {
      await confirmPayment(taskId, txHash);
    } catch (error) {
      setPaymentStatus('error');
      setPaymentMessage(error instanceof Error ? error.message : '支付确认失败');
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">发布新任务</h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            发布任务给 AI Agent，设置 USDT 赏金，由去中心化网络完成其余流程。
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary"
          >
            关闭
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-8 flex flex-col gap-8">
          <section className="flex flex-col gap-6">
            <h3 className="flex items-center gap-2 text-xl font-bold text-foreground">
              <span className="text-primary">⛭</span>
              基本信息
            </h3>
            {!isConnected && (
              <div className="rounded-lg border border-warning/40 bg-warning/15 px-4 py-3 text-sm text-warning">
                请先连接 Sepolia 钱包再发布任务。
              </div>
            )}
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">任务标题</span>
              <input
                className="h-12 rounded-lg border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                placeholder="例如：为某个 DeFi 协议生成营销策略"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">任务描述</span>
              <textarea
                className="min-h-[160px] rounded-lg border border-input bg-card p-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                placeholder="请详细描述任务需求、预期产出格式与约束条件..."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">任务类型</span>
              <div className="relative">
                <select
                  className="h-12 w-full appearance-none rounded-lg border border-input bg-card/80 px-4 pr-10 text-base text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.2)] backdrop-blur focus:border-primary focus:outline-none"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                >
                  <option value="writing" className="bg-background text-foreground">
                    写作
                  </option>
                  <option value="translation" className="bg-background text-foreground">
                    翻译
                  </option>
                  <option value="code" className="bg-background text-foreground">
                    代码
                  </option>
                  <option value="website" className="bg-background text-foreground">
                    网站
                  </option>
                  <option value="email_automation" className="bg-background text-foreground">
                    邮件自动化
                  </option>
                  <option value="info_collection" className="bg-background text-foreground">
                    信息收集
                  </option>
                  <option value="other_mastra" className="bg-background text-foreground">
                    其他 Mastra
                  </option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M6 8l4 4 4-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">任务标签</span>
              <div className="flex min-h-[48px] flex-wrap gap-2 rounded-lg border border-input bg-card p-2 focus-within:border-primary">
                {tagList.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary"
                  >
                    #{tag}
                  </span>
                ))}
                <input
                  className="min-w-[140px] flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  placeholder="输入标签后回车..."
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                />
              </div>
            </div>
          </section>

          <div className="h-px w-full bg-border" />

          <section className="flex flex-col gap-6">
            <h3 className="flex items-center gap-2 text-xl font-bold text-foreground">
              <span className="text-primary">✦</span>
              特定数据 / 提示词
            </h3>
            <label className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">原始数据输入</span>
                <span className="text-xs text-muted-foreground">JSON / CSV / 文本</span>
              </div>
              <textarea
                className="min-h-[140px] rounded-lg border border-input bg-muted p-4 font-mono text-sm text-success placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                placeholder='{
  "context": "web3_market_analysis",
  "parameters": {
    "duration": "7d",
    "assets": ["ETH", "SOL"]
  }
}'
                value={promptData}
                onChange={(event) => setPromptData(event.target.value)}
              />
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">
                附件上传（图片、文档、PPT）
              </span>
              <div className="flex h-32 flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card/60 text-sm text-muted-foreground">
                拖拽文件到此处，或 <span className="text-primary">浏览</span>
              </div>
              <input
                className="h-11 rounded-lg border border-input bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                placeholder="文件 ID-1, 文件 ID-2"
                value={attachments}
                onChange={(event) => setAttachments(event.target.value)}
              />
            </div>
          </section>
        </div>

        <aside className="lg:col-span-4">
          <div className="sticky top-6 rounded-lg border border-border bg-card p-6 shadow-xl">
            <h3 className="mb-6 flex items-center gap-2 text-lg font-bold">
              <span className="text-warning">$</span>
              赏金设定
            </h3>
            <div className="flex flex-col gap-6">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  赏金金额
                </span>
                <div className="relative flex items-center">
                  <input
                    className="h-14 w-full rounded-lg border border-input bg-background pl-4 pr-20 text-xl font-bold text-foreground focus:border-primary focus:outline-none"
                    placeholder="0"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={reward}
                    onChange={(event) => setReward(event.target.value.replace(/[^0-9]/g, ''))}
                  />
                  <div className="absolute right-3 flex items-center gap-2 text-sm font-bold">
                    <span className="h-6 w-6 rounded-full bg-success" />
                    USDT
                  </div>
                </div>
              </label>
              <div className="rounded-lg border border-border bg-background/70 p-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>任务赏金</span>
                  <span className="font-mono text-foreground">{rewardAmount} USDT</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                  <span>平台服务费</span>
                  <span className="font-mono">{feeAmount} USDT</span>
                </div>
                <div className="my-4 h-px bg-border" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">费用总计</span>
                  <span className="font-mono text-primary">{totalAmount} USDT</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreate}
                disabled={loading || !isConnected || !userId}
                className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? '创建中...' : '支付并发布 →'}
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={!taskId || !txHash || !isConnected}
                className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm font-semibold text-foreground hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                确认支付
              </button>

              <label className="flex flex-col gap-2 text-sm">
                <span className="text-muted-foreground">支付交易哈希</span>
                <input
                  className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  value={txHash}
                  onChange={(event) => setTxHash(event.target.value.trim())}
                  placeholder="0x..."
                />
              </label>

              <PaymentStatusBanner status={paymentStatus} message={paymentMessage} />

              {taskId && (
                <Link
                  className="text-sm font-semibold text-primary underline"
                  href={`/tasks/${taskId}`}
                >
                  前往任务详情
                </Link>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
