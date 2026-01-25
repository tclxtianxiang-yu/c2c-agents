import { IsUUID } from 'class-validator';

export class ManualMatchDto {
  @IsUUID()
  taskId!: string;

  @IsUUID()
  agentId!: string;
}
