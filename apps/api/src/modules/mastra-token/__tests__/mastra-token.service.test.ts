import type { MastraToken, MastraTokenSummary } from '@c2c-agents/shared';
import { ErrorCode, ValidationError } from '@c2c-agents/shared';
import { HttpException } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { MastraTokenRepository } from '../mastra-token.repository';
import { MastraTokenService } from '../mastra-token.service';

describe('MastraTokenService', () => {
  let service: MastraTokenService;

  const testUserId = '11111111-1111-1111-1111-111111111111';
  const testUserId2 = '22222222-2222-2222-2222-222222222222';

  const mockToken: MastraToken = {
    id: 'token-1',
    ownerId: testUserId,
    name: 'Test Token',
    token: 'mastra_test_token_value_12345',
    createdAt: '2026-01-24T00:00:00.000Z',
    updatedAt: '2026-01-24T00:00:00.000Z',
  };

  const mockTokenSummary: MastraTokenSummary = {
    id: 'token-1',
    name: 'Test Token',
    createdAt: '2026-01-24T00:00:00.000Z',
  };

  const mockRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findByOwnerId: jest.fn(),
    findSummariesByOwnerId: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    countByOwnerId: jest.fn(),
  };

  const expectHttpErrorCode = async (
    promise: Promise<unknown>,
    status: number,
    code: ErrorCode
  ) => {
    try {
      await promise;
      throw new Error('Expected error');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      const httpError = error as HttpException;
      expect(httpError.getStatus()).toBe(status);
      const response = httpError.getResponse() as { code: string };
      expect(response.code).toBe(code);
    }
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MastraTokenService,
        {
          provide: MastraTokenRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<MastraTokenService>(MastraTokenService);

    jest.clearAllMocks();
  });

  // ============================================================
  // createToken
  // ============================================================

  describe('createToken', () => {
    const validCreateInput = {
      name: 'Test Token',
      token: 'mastra_test_token_value_12345',
    };

    it('should create token successfully', async () => {
      mockRepository.countByOwnerId.mockResolvedValue(0);
      mockRepository.create.mockResolvedValue(mockToken);

      const result = await service.createToken(testUserId, validCreateInput);

      expect(result).toEqual(mockToken);
      expect(mockRepository.countByOwnerId).toHaveBeenCalledWith(testUserId);
      expect(mockRepository.create).toHaveBeenCalledWith({
        ownerId: testUserId,
        name: validCreateInput.name,
        token: validCreateInput.token,
      });
    });

    it('should trim name and token before saving', async () => {
      mockRepository.countByOwnerId.mockResolvedValue(0);
      mockRepository.create.mockResolvedValue(mockToken);

      await service.createToken(testUserId, {
        name: '  Test Token  ',
        token: '  mastra_test_token_value_12345  ',
      });

      expect(mockRepository.create).toHaveBeenCalledWith({
        ownerId: testUserId,
        name: 'Test Token',
        token: 'mastra_test_token_value_12345',
      });
    });

    it('should throw ValidationError if name is empty', async () => {
      await expect(
        service.createToken(testUserId, { ...validCreateInput, name: '' })
      ).rejects.toThrow(ValidationError);
      await expect(
        service.createToken(testUserId, { ...validCreateInput, name: '   ' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if name exceeds 100 characters', async () => {
      const longName = 'a'.repeat(101);
      await expect(
        service.createToken(testUserId, { ...validCreateInput, name: longName })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if token value is empty', async () => {
      await expect(
        service.createToken(testUserId, { ...validCreateInput, token: '' })
      ).rejects.toThrow(ValidationError);
      await expect(
        service.createToken(testUserId, { ...validCreateInput, token: '   ' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw error when max tokens per user reached (20)', async () => {
      mockRepository.countByOwnerId.mockResolvedValue(20);

      await expectHttpErrorCode(
        service.createToken(testUserId, validCreateInput),
        400,
        ErrorCode.BUSINESS_OPERATION_NOT_ALLOWED
      );
    });

    it('should allow creating token when at 19 tokens', async () => {
      mockRepository.countByOwnerId.mockResolvedValue(19);
      mockRepository.create.mockResolvedValue(mockToken);

      const result = await service.createToken(testUserId, validCreateInput);

      expect(result).toEqual(mockToken);
      expect(mockRepository.create).toHaveBeenCalled();
    });
  });

  // ============================================================
  // getToken
  // ============================================================

  describe('getToken', () => {
    it('should return token when found and belongs to user', async () => {
      mockRepository.findById.mockResolvedValue(mockToken);

      const result = await service.getToken(testUserId, mockToken.id);

      expect(result).toEqual(mockToken);
      expect(mockRepository.findById).toHaveBeenCalledWith(mockToken.id);
    });

    it('should throw 404 when token not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expectHttpErrorCode(
        service.getToken(testUserId, 'non-existent-token'),
        404,
        ErrorCode.BUSINESS_RESOURCE_NOT_FOUND
      );
    });

    it('should throw 403 when token does not belong to user', async () => {
      mockRepository.findById.mockResolvedValue(mockToken);

      await expectHttpErrorCode(
        service.getToken(testUserId2, mockToken.id),
        403,
        ErrorCode.AUTH_FORBIDDEN
      );
    });
  });

  // ============================================================
  // listTokens
  // ============================================================

  describe('listTokens', () => {
    it('should return all tokens for user', async () => {
      const tokens = [mockToken, { ...mockToken, id: 'token-2', name: 'Token 2' }];
      mockRepository.findByOwnerId.mockResolvedValue(tokens);

      const result = await service.listTokens(testUserId);

      expect(result).toEqual(tokens);
      expect(mockRepository.findByOwnerId).toHaveBeenCalledWith(testUserId);
    });

    it('should return empty array when user has no tokens', async () => {
      mockRepository.findByOwnerId.mockResolvedValue([]);

      const result = await service.listTokens(testUserId);

      expect(result).toEqual([]);
      expect(mockRepository.findByOwnerId).toHaveBeenCalledWith(testUserId);
    });
  });

  // ============================================================
  // listTokenSummaries
  // ============================================================

  describe('listTokenSummaries', () => {
    it('should return token summaries without token values', async () => {
      const summaries = [mockTokenSummary, { ...mockTokenSummary, id: 'token-2', name: 'Token 2' }];
      mockRepository.findSummariesByOwnerId.mockResolvedValue(summaries);

      const result = await service.listTokenSummaries(testUserId);

      expect(result).toEqual(summaries);
      expect(mockRepository.findSummariesByOwnerId).toHaveBeenCalledWith(testUserId);
      // Verify summaries don't contain token value
      for (const summary of result) {
        expect(summary).not.toHaveProperty('token');
      }
    });

    it('should return empty array when user has no tokens', async () => {
      mockRepository.findSummariesByOwnerId.mockResolvedValue([]);

      const result = await service.listTokenSummaries(testUserId);

      expect(result).toEqual([]);
      expect(mockRepository.findSummariesByOwnerId).toHaveBeenCalledWith(testUserId);
    });
  });

  // ============================================================
  // updateToken
  // ============================================================

  describe('updateToken', () => {
    it('should update token name successfully', async () => {
      const updatedToken = { ...mockToken, name: 'Updated Name' };
      mockRepository.findById.mockResolvedValue(mockToken);
      mockRepository.update.mockResolvedValue(updatedToken);

      const result = await service.updateToken(testUserId, mockToken.id, { name: 'Updated Name' });

      expect(result).toEqual(updatedToken);
      expect(mockRepository.update).toHaveBeenCalledWith(mockToken.id, { name: 'Updated Name' });
    });

    it('should update token value successfully', async () => {
      const updatedToken = { ...mockToken, token: 'new_token_value' };
      mockRepository.findById.mockResolvedValue(mockToken);
      mockRepository.update.mockResolvedValue(updatedToken);

      const result = await service.updateToken(testUserId, mockToken.id, {
        token: 'new_token_value',
      });

      expect(result).toEqual(updatedToken);
      expect(mockRepository.update).toHaveBeenCalledWith(mockToken.id, {
        token: 'new_token_value',
      });
    });

    it('should update both name and token', async () => {
      const updatedToken = { ...mockToken, name: 'New Name', token: 'new_token_value' };
      mockRepository.findById.mockResolvedValue(mockToken);
      mockRepository.update.mockResolvedValue(updatedToken);

      const result = await service.updateToken(testUserId, mockToken.id, {
        name: 'New Name',
        token: 'new_token_value',
      });

      expect(result).toEqual(updatedToken);
      expect(mockRepository.update).toHaveBeenCalledWith(mockToken.id, {
        name: 'New Name',
        token: 'new_token_value',
      });
    });

    it('should trim name and token before updating', async () => {
      mockRepository.findById.mockResolvedValue(mockToken);
      mockRepository.update.mockResolvedValue(mockToken);

      await service.updateToken(testUserId, mockToken.id, {
        name: '  Trimmed Name  ',
        token: '  trimmed_token  ',
      });

      expect(mockRepository.update).toHaveBeenCalledWith(mockToken.id, {
        name: 'Trimmed Name',
        token: 'trimmed_token',
      });
    });

    it('should throw 404 when token not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expectHttpErrorCode(
        service.updateToken(testUserId, 'non-existent-token', { name: 'New Name' }),
        404,
        ErrorCode.BUSINESS_RESOURCE_NOT_FOUND
      );
    });

    it('should throw 403 when token does not belong to user', async () => {
      mockRepository.findById.mockResolvedValue(mockToken);

      await expectHttpErrorCode(
        service.updateToken(testUserId2, mockToken.id, { name: 'New Name' }),
        403,
        ErrorCode.AUTH_FORBIDDEN
      );
    });

    it('should throw ValidationError if name is empty string', async () => {
      mockRepository.findById.mockResolvedValue(mockToken);

      await expect(service.updateToken(testUserId, mockToken.id, { name: '' })).rejects.toThrow(
        ValidationError
      );
      await expect(service.updateToken(testUserId, mockToken.id, { name: '   ' })).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError if name exceeds 100 characters', async () => {
      mockRepository.findById.mockResolvedValue(mockToken);
      const longName = 'a'.repeat(101);

      await expect(
        service.updateToken(testUserId, mockToken.id, { name: longName })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if token value is empty string', async () => {
      mockRepository.findById.mockResolvedValue(mockToken);

      await expect(service.updateToken(testUserId, mockToken.id, { token: '' })).rejects.toThrow(
        ValidationError
      );
      await expect(service.updateToken(testUserId, mockToken.id, { token: '   ' })).rejects.toThrow(
        ValidationError
      );
    });

    it('should allow undefined name (no change)', async () => {
      mockRepository.findById.mockResolvedValue(mockToken);
      mockRepository.update.mockResolvedValue(mockToken);

      await service.updateToken(testUserId, mockToken.id, { token: 'new_value' });

      expect(mockRepository.update).toHaveBeenCalledWith(mockToken.id, {
        name: undefined,
        token: 'new_value',
      });
    });
  });

  // ============================================================
  // deleteToken
  // ============================================================

  describe('deleteToken', () => {
    it('should delete token successfully', async () => {
      mockRepository.findById.mockResolvedValue(mockToken);
      mockRepository.delete.mockResolvedValue(undefined);

      await service.deleteToken(testUserId, mockToken.id);

      expect(mockRepository.findById).toHaveBeenCalledWith(mockToken.id);
      expect(mockRepository.delete).toHaveBeenCalledWith(mockToken.id);
    });

    it('should throw 404 when token not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expectHttpErrorCode(
        service.deleteToken(testUserId, 'non-existent-token'),
        404,
        ErrorCode.BUSINESS_RESOURCE_NOT_FOUND
      );

      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw 403 when token does not belong to user', async () => {
      mockRepository.findById.mockResolvedValue(mockToken);

      await expectHttpErrorCode(
        service.deleteToken(testUserId2, mockToken.id),
        403,
        ErrorCode.AUTH_FORBIDDEN
      );

      expect(mockRepository.delete).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // getTokenForAgent
  // ============================================================

  describe('getTokenForAgent', () => {
    it('should return token when found', async () => {
      mockRepository.findById.mockResolvedValue(mockToken);

      const result = await service.getTokenForAgent(mockToken.id);

      expect(result).toEqual(mockToken);
      expect(mockRepository.findById).toHaveBeenCalledWith(mockToken.id);
    });

    it('should return null when token not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.getTokenForAgent('non-existent-token');

      expect(result).toBeNull();
      expect(mockRepository.findById).toHaveBeenCalledWith('non-existent-token');
    });

    it('should not check ownership (internal use)', async () => {
      // getTokenForAgent is used internally for agent execution
      // It should not check ownership since it's called with agent context
      mockRepository.findById.mockResolvedValue(mockToken);

      const result = await service.getTokenForAgent(mockToken.id);

      expect(result).toEqual(mockToken);
      // Should only call findById, no ownership check
      expect(mockRepository.findById).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // Edge cases and boundary conditions
  // ============================================================

  describe('edge cases', () => {
    it('should handle exactly 100 character name', async () => {
      mockRepository.countByOwnerId.mockResolvedValue(0);
      mockRepository.create.mockResolvedValue(mockToken);

      const name = 'a'.repeat(100);
      await expect(
        service.createToken(testUserId, { name, token: 'valid_token' })
      ).resolves.toBeDefined();
    });

    it('should allow creating multiple tokens for same user (under limit)', async () => {
      mockRepository.countByOwnerId.mockResolvedValue(5);
      mockRepository.create.mockResolvedValue(mockToken);

      const result = await service.createToken(testUserId, {
        name: 'Another Token',
        token: 'another_token_value',
      });

      expect(result).toBeDefined();
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should handle concurrent create requests correctly', async () => {
      // First check returns 19, second check returns 20 (race condition simulation)
      mockRepository.countByOwnerId.mockResolvedValueOnce(19).mockResolvedValueOnce(20);
      mockRepository.create.mockResolvedValue(mockToken);

      // First request should succeed
      const result1 = await service.createToken(testUserId, {
        name: 'Token 1',
        token: 'token_1_value',
      });
      expect(result1).toBeDefined();

      // Second request should fail (count now 20)
      await expectHttpErrorCode(
        service.createToken(testUserId, { name: 'Token 2', token: 'token_2_value' }),
        400,
        ErrorCode.BUSINESS_OPERATION_NOT_ALLOWED
      );
    });
  });
});
