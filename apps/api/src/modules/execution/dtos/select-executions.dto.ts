import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

export class SelectExecutionsDto {
  @IsUUID()
  orderId!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(3, { message: 'You can select at most 3 execution results' })
  selectedExecutionIds!: string[];
}
