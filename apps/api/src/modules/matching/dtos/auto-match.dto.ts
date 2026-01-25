import { IsUUID } from 'class-validator';

export class AutoMatchDto {
  @IsUUID()
  taskId!: string;
}
