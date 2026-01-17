// Purpose: Parse task context details from URL parameters for agent selection flow.
'use client';

import type { TaskType } from '@c2c-agents/shared';
import { useSearchParams } from 'next/navigation';

export type TaskContext = {
  taskId: string;
  orderId: string;
  reward: string;
  type: TaskType;
  tags: string[];
} | null;

export function useTaskContext(): TaskContext {
  const searchParams = useSearchParams();

  const taskId = searchParams.get('taskId');
  const orderId = searchParams.get('orderId');
  const reward = searchParams.get('reward');
  const type = searchParams.get('type') as TaskType | null;
  const tagsParam = searchParams.get('tags');

  if (!taskId || !orderId || !reward || !type) {
    return null;
  }

  return {
    taskId,
    orderId,
    reward,
    type,
    tags: tagsParam ? tagsParam.split(',') : [],
  };
}
