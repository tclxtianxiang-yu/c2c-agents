import type { TaskType } from '@c2c-agents/shared';

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  writing: '写作',
  translation: '翻译',
  code: '代码',
  website: '网站',
  email_automation: '邮件自动化',
  info_collection: '信息收集',
  other_mastra: '其他 Mastra',
};
