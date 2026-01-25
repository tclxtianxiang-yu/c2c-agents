import type { Order, Task } from '@c2c-agents/shared';
import Link from 'next/link';
import { ActionSection } from './_components/ActionSection';
import { OrderStatusSection } from './_components/OrderStatusSection';
import { TaskInfoSection } from './_components/TaskInfoSection';

type TaskDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

async function fetchTask(id: string): Promise<Task | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/tasks/${id}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return response.json() as Promise<Task>;
  } catch {
    return null;
  }
}

async function fetchOrder(orderId: string): Promise<Order | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/orders/${orderId}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return response.json() as Promise<Order>;
  } catch {
    return null;
  }
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const { id } = await params;
  const task = await fetchTask(id);

  if (!task) {
    return (
      <main className="min-h-screen bg-background px-4 py-12 text-foreground">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-card p-8 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Task Not Found
          </p>
          <h1 className="mt-4 text-2xl font-semibold">无法找到该任务</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            请求的 Task ID: <span className="font-mono text-foreground">{id}</span>
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:border-primary/40 hover:text-primary"
            >
              返回首页
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const order = task.currentOrderId ? await fetchOrder(task.currentOrderId) : null;

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto w-full max-w-7xl">
        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            首页
          </Link>
          <span>/</span>
          <Link href="/task" className="hover:text-foreground">
            我的任务
          </Link>
          <span>/</span>
          <span className="text-foreground">{task.title}</span>
        </nav>

        {/* Main Content */}
        <div className="space-y-6">
          <TaskInfoSection task={task} />
          <OrderStatusSection order={order} />
          <ActionSection task={task} order={order} />
        </div>
      </div>
    </main>
  );
}
