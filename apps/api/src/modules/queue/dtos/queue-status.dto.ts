import type { QueueItem } from '@c2c-agents/shared';

export interface QueueStatusDto {
  agentId: string;
  queuedCount: number;
  capacity: number;
  available: number;
  items: QueueItem[];
}
