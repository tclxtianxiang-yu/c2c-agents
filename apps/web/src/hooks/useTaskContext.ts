'use client';

import type { TaskType } from '@c2c-agents/shared';
import { useSearchParams } from 'next/navigation';

export type TaskContext = {
  taskId: string;
  reward: string;
  type: TaskType;
  tags: string[];
} | null;

export function useTaskContext(): TaskContext {
  const searchParams = useSearchParams();

  const taskId = searchParams.get('taskId');
  const reward = searchParams.get('reward');
  const type = searchParams.get('type') as TaskType | null;
  const tagsParam = searchParams.get('tags');

  if (!taskId || !reward || !type) {
    return null;
  }

  return {
    taskId,
    reward,
    type,
    tags: tagsParam ? tagsParam.split(',') : [],
  };
}
