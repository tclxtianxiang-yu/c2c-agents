'use client';

import Link from 'next/link';
import { TopNav } from '../layout/TopNav';

type PlaceholderPageProps = {
  title: string;
  subtitle: string;
  description: string;
};

export function PlaceholderPage({ title, subtitle, description }: PlaceholderPageProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopNav />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-14">
        <div className="rounded-3xl border border-border bg-card/80 p-10 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-2 text-xs text-primary">
            <span className="uppercase tracking-[0.3em] font-semibold">即将上线</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground" />
            <span className="text-muted-foreground">{subtitle}</span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{description}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/task"
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground"
            >
              返回任务
            </Link>
            <Link
              href="/tasks/create"
              className="rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary"
            >
              发布任务
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
