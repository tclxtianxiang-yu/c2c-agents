// 占位文件，后续根据 supabase_init.sql 定义 DTO
export interface Task {
  id: string;
  title: string;
  description: string;
  expectedReward: number;
  status: string;
}

export interface Order {
  id: string;
  taskId: string;
  agentId: string;
  status: string;
}

export interface Agent {
  id: string;
  name: string;
  status: string;
}
