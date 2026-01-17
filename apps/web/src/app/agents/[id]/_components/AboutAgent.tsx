import type { Agent } from '@c2c-agents/shared';
import { TASK_TYPE_LABELS } from '@/utils/taskLabels';

type AboutAgentProps = {
  agent: Agent;
};

export function AboutAgent({ agent }: AboutAgentProps) {
  // 优先使用 tags，若为空则回退到 supportedTaskTypes
  const capabilities =
    agent.tags.length > 0
      ? agent.tags
      : agent.supportedTaskTypes.map((type) => `#${TASK_TYPE_LABELS[type] ?? type}`);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 text-primary">
        <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <h2 className="text-lg font-semibold text-foreground">About this Agent</h2>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{agent.description}</p>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-foreground">Capabilities</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {capabilities.map((cap) => (
            <span
              key={cap}
              className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground"
            >
              {cap.startsWith('#') ? cap : `#${cap}`}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
