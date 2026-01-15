import { TopNav } from '../../../components/layout/TopNav';
import { CreateTaskForm } from '../../../components/pages/CreateTaskForm';

export default function CreateTaskPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopNav />
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-10 lg:px-10">
        <CreateTaskForm />
      </div>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © 2026 Web3 AI Agents 平台。保留所有权利。
      </footer>
    </main>
  );
}
