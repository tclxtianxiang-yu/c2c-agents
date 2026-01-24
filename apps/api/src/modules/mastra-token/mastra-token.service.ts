import type { MastraToken, MastraTokenSummary } from '@c2c-agents/shared';
import { ErrorCode, ValidationError } from '@c2c-agents/shared';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import type { CreateMastraTokenDto } from './dtos/create-mastra-token.dto';
import type { UpdateMastraTokenDto } from './dtos/update-mastra-token.dto';
import { MastraTokenRepository } from './mastra-token.repository';

const MAX_TOKENS_PER_USER = 20;

@Injectable()
export class MastraTokenService {
  constructor(
    @Inject(MastraTokenRepository) private readonly tokenRepository: MastraTokenRepository
  ) {}

  async createToken(userId: string, dto: CreateMastraTokenDto): Promise<MastraToken> {
    if (!dto.name || dto.name.trim().length === 0) {
      throw new ValidationError('Token name is required');
    }
    if (dto.name.trim().length > 100) {
      throw new ValidationError('Token name must be 100 characters or less');
    }
    if (!dto.token || dto.token.trim().length === 0) {
      throw new ValidationError('Token value is required');
    }

    const count = await this.tokenRepository.countByOwnerId(userId);
    if (count >= MAX_TOKENS_PER_USER) {
      throw new HttpException(
        {
          code: ErrorCode.BUSINESS_OPERATION_NOT_ALLOWED,
          message: `Maximum ${MAX_TOKENS_PER_USER} tokens per user`,
        },
        400
      );
    }

    return this.tokenRepository.create({
      ownerId: userId,
      name: dto.name.trim(),
      token: dto.token.trim(),
    });
  }

  async listTokens(userId: string): Promise<MastraToken[]> {
    return this.tokenRepository.findByOwnerId(userId);
  }

  async listTokenSummaries(userId: string): Promise<MastraTokenSummary[]> {
    return this.tokenRepository.findSummariesByOwnerId(userId);
  }

  async getToken(userId: string, tokenId: string): Promise<MastraToken> {
    const token = await this.tokenRepository.findById(tokenId);
    if (!token) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Token not found' },
        404
      );
    }

    if (token.ownerId !== userId) {
      throw new HttpException(
        { code: ErrorCode.AUTH_FORBIDDEN, message: 'Token does not belong to current user' },
        403
      );
    }

    return token;
  }

  async updateToken(
    userId: string,
    tokenId: string,
    dto: UpdateMastraTokenDto
  ): Promise<MastraToken> {
    const token = await this.tokenRepository.findById(tokenId);
    if (!token) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Token not found' },
        404
      );
    }

    if (token.ownerId !== userId) {
      throw new HttpException(
        { code: ErrorCode.AUTH_FORBIDDEN, message: 'Token does not belong to current user' },
        403
      );
    }

    if (dto.name !== undefined && dto.name.trim().length === 0) {
      throw new ValidationError('Token name cannot be empty');
    }
    if (dto.name !== undefined && dto.name.trim().length > 100) {
      throw new ValidationError('Token name must be 100 characters or less');
    }
    if (dto.token !== undefined && dto.token.trim().length === 0) {
      throw new ValidationError('Token value cannot be empty');
    }

    return this.tokenRepository.update(tokenId, {
      name: dto.name?.trim(),
      token: dto.token?.trim(),
    });
  }

  async deleteToken(userId: string, tokenId: string): Promise<void> {
    const token = await this.tokenRepository.findById(tokenId);
    if (!token) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Token not found' },
        404
      );
    }

    if (token.ownerId !== userId) {
      throw new HttpException(
        { code: ErrorCode.AUTH_FORBIDDEN, message: 'Token does not belong to current user' },
        403
      );
    }

    await this.tokenRepository.delete(tokenId);
  }

  async getTokenForAgent(tokenId: string): Promise<MastraToken | null> {
    return this.tokenRepository.findById(tokenId);
  }
}
