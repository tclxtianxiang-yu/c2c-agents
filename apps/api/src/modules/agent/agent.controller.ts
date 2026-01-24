import { AgentStatus, ValidationError } from '@c2c-agents/shared';
import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { AgentService } from './agent.service';
import type { AgentListQueryDto } from './dtos/agent-list-query.dto';
import type { CreateAgentDto } from './dtos/create-agent.dto';
import type { UpdateAgentDto } from './dtos/update-agent.dto';

function parseTags(tags: string | string[] | undefined): string[] | undefined {
  if (!tags) return undefined;
  if (Array.isArray(tags)) return tags.filter(Boolean);
  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseEnum<T extends Record<string, string>>(
  value: string | undefined,
  enumObj: T
): T[keyof T] | undefined {
  if (!value) return undefined;
  const values = Object.values(enumObj) as string[];
  if (values.includes(value)) return value as T[keyof T];
  return undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

@Controller('agents')
export class AgentController {
  constructor(@Inject(AgentService) private readonly agentService: AgentService) {}

  // POST /agents — 创建 Agent（需要 x-user-id header）
  @Post()
  createAgent(@Headers('x-user-id') userId: string | undefined, @Body() body: CreateAgentDto) {
    if (!userId) {
      throw new ValidationError('x-user-id header is required');
    }
    return this.agentService.createAgent(userId, body);
  }

  // GET /agents/mine — B 用户获取自己的 Agent 列表
  // 注意：此路由必须在 /agents/:id 之前定义，否则 mine 会被当作 id 参数
  @Get('mine')
  getMyAgents(@Headers('x-user-id') userId: string | undefined) {
    if (!userId) {
      throw new ValidationError('x-user-id header is required');
    }
    return this.agentService.findByOwnerId(userId);
  }

  // GET /agents/:id — 获取单个 Agent
  @Get(':id')
  getAgent(@Param('id') agentId: string) {
    return this.agentService.findById(agentId);
  }

  // PATCH /agents/:id — 更新 Agent（需要 x-user-id header）
  @Patch(':id')
  updateAgent(
    @Headers('x-user-id') userId: string | undefined,
    @Param('id') agentId: string,
    @Body() body: UpdateAgentDto
  ) {
    if (!userId) {
      throw new ValidationError('x-user-id header is required');
    }
    return this.agentService.updateAgent(userId, agentId, body);
  }

  // GET /agents — 列表 Agent
  @Get()
  listAgents(
    @Headers('x-user-id') userId: string | undefined,
    @Query() query: Record<string, string | string[] | undefined>
  ) {
    const mine = parseBoolean(query.mine as string | undefined);
    if (mine && !userId) {
      throw new ValidationError('x-user-id header is required');
    }
    const parsedQuery: AgentListQueryDto = {
      keyword: query.keyword as string | undefined,
      tags: parseTags(query.tags),
      taskType: query.taskType as AgentListQueryDto['taskType'],
      status: parseEnum(query.status as string | undefined, AgentStatus),
      minPrice: query.minPrice as string | undefined,
      maxPrice: query.maxPrice as string | undefined,
      isListed: parseBoolean(query.isListed as string | undefined),
      ownerId: mine ? userId : (query.ownerId as string | undefined),
    };

    return this.agentService.listAgents(parsedQuery);
  }
}
