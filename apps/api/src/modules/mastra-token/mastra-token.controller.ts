import type { MastraToken, MastraTokenSummary } from '@c2c-agents/shared';
import { ValidationError } from '@c2c-agents/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { CreateMastraTokenDto } from './dtos/create-mastra-token.dto';
import type { UpdateMastraTokenDto } from './dtos/update-mastra-token.dto';
import { MastraTokenService } from './mastra-token.service';

function requireUserId(userId: string | undefined): asserts userId is string {
  if (!userId) {
    throw new ValidationError('x-user-id header is required');
  }
}

@Controller('mastra-tokens')
export class MastraTokenController {
  constructor(@Inject(MastraTokenService) private readonly tokenService: MastraTokenService) {}

  @Post()
  async createToken(
    @Headers('x-user-id') userId: string | undefined,
    @Body() dto: CreateMastraTokenDto
  ): Promise<MastraToken> {
    requireUserId(userId);
    return this.tokenService.createToken(userId, dto);
  }

  @Get()
  async listTokens(
    @Headers('x-user-id') userId: string | undefined,
    @Query('summary') summary?: string
  ): Promise<MastraToken[] | MastraTokenSummary[]> {
    requireUserId(userId);
    if (summary === 'true') {
      return this.tokenService.listTokenSummaries(userId);
    }
    return this.tokenService.listTokens(userId);
  }

  @Get(':tokenId')
  async getToken(
    @Headers('x-user-id') userId: string | undefined,
    @Param('tokenId') tokenId: string
  ): Promise<MastraToken> {
    requireUserId(userId);
    return this.tokenService.getToken(userId, tokenId);
  }

  @Patch(':tokenId')
  async updateToken(
    @Headers('x-user-id') userId: string | undefined,
    @Param('tokenId') tokenId: string,
    @Body() dto: UpdateMastraTokenDto
  ): Promise<MastraToken> {
    requireUserId(userId);
    return this.tokenService.updateToken(userId, tokenId, dto);
  }

  @Delete(':tokenId')
  @HttpCode(204)
  async deleteToken(
    @Headers('x-user-id') userId: string | undefined,
    @Param('tokenId') tokenId: string
  ): Promise<void> {
    requireUserId(userId);
    await this.tokenService.deleteToken(userId, tokenId);
  }
}
