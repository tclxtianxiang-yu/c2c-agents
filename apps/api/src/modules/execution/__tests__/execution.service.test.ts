import type { Execution } from '@c2c-agents/shared';
import { ErrorCode, ValidationError } from '@c2c-agents/shared';
import { HttpException } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { ExecutionWithAgent, OrderInfo } from '../execution.repository';
import { ExecutionRepository } from '../execution.repository';
import { ExecutionService } from '../execution.service';

describe('ExecutionService', () => {
  let service: ExecutionService;

  const testUserId = '11111111-1111-1111-1111-111111111111';
  const testUserId2 = '22222222-2222-2222-2222-222222222222';
  const testOrderId = 'order-1111-1111-1111-111111111111';
  const testExecutionId1 = 'exec-1111-1111-1111-111111111111';
  const testExecutionId2 = 'exec-2222-2222-2222-222222222222';
  const testExecutionId3 = 'exec-3333-3333-3333-333333333333';
  const testAgentId1 = 'agent-1111-1111-1111-111111111111';
  const testAgentId2 = 'agent-2222-2222-2222-222222222222';

  const mockOrder: OrderInfo = {
    id: testOrderId,
    creatorId: testUserId,
    providerId: testUserId2,
    status: 'Executing',
    executionPhase: 'executing',
  };

  const mockExecution: Execution = {
    id: testExecutionId1,
    orderId: testOrderId,
    agentId: testAgentId1,
    status: 'completed',
    mastraRunId: 'run-123',
    mastraStatus: 'completed',
    resultPreview: 'Preview content',
    resultContent: 'Full content',
    resultUrl: null,
    errorMessage: null,
    startedAt: '2026-01-24T00:00:00.000Z',
    completedAt: '2026-01-24T01:00:00.000Z',
    createdAt: '2026-01-24T00:00:00.000Z',
    updatedAt: '2026-01-24T01:00:00.000Z',
  };

  const mockExecutionWithAgent: ExecutionWithAgent = {
    ...mockExecution,
    agent: {
      id: testAgentId1,
      name: 'Test Agent 1',
      avatarUrl: null,
    },
  };

  const mockRepository = {
    findOrderById: jest.fn(),
    findExecutionById: jest.fn(),
    findExecutionsByOrderId: jest.fn(),
    findExecutionsByOrderIdWithAgent: jest.fn(),
    updateExecution: jest.fn(),
    updateExecutionsBatch: jest.fn(),
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
        ExecutionService,
        {
          provide: ExecutionRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ExecutionService>(ExecutionService);

    jest.clearAllMocks();
  });

  // ============================================================
  // getExecutionsByOrder
  // ============================================================

  describe('getExecutionsByOrder', () => {
    it('should return executions for order creator', async () => {
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.findExecutionsByOrderIdWithAgent.mockResolvedValue([mockExecutionWithAgent]);

      const result = await service.getExecutionsByOrder(testUserId, testOrderId);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockExecutionWithAgent);
      expect(mockRepository.findOrderById).toHaveBeenCalledWith(testOrderId);
      expect(mockRepository.findExecutionsByOrderIdWithAgent).toHaveBeenCalledWith(testOrderId);
    });

    it('should return executions for order provider', async () => {
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.findExecutionsByOrderIdWithAgent.mockResolvedValue([mockExecutionWithAgent]);

      const result = await service.getExecutionsByOrder(testUserId2, testOrderId);

      expect(result).toHaveLength(1);
      expect(mockRepository.findOrderById).toHaveBeenCalledWith(testOrderId);
    });

    it('should throw 404 if order not found', async () => {
      mockRepository.findOrderById.mockResolvedValue(null);

      await expectHttpErrorCode(
        service.getExecutionsByOrder(testUserId, testOrderId),
        404,
        ErrorCode.BUSINESS_RESOURCE_NOT_FOUND
      );
    });

    it('should throw 403 if user is not creator or provider', async () => {
      mockRepository.findOrderById.mockResolvedValue(mockOrder);

      const unauthorizedUserId = '33333333-3333-3333-3333-333333333333';

      await expectHttpErrorCode(
        service.getExecutionsByOrder(unauthorizedUserId, testOrderId),
        403,
        ErrorCode.AUTH_FORBIDDEN
      );
    });

    it('should return empty array if no executions exist', async () => {
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.findExecutionsByOrderIdWithAgent.mockResolvedValue([]);

      const result = await service.getExecutionsByOrder(testUserId, testOrderId);

      expect(result).toEqual([]);
    });

    it('should return multiple executions with agent info', async () => {
      const executions: ExecutionWithAgent[] = [
        mockExecutionWithAgent,
        {
          ...mockExecution,
          id: testExecutionId2,
          agentId: testAgentId2,
          agent: {
            id: testAgentId2,
            name: 'Test Agent 2',
            avatarUrl: 'https://example.com/avatar.png',
          },
        },
      ];
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.findExecutionsByOrderIdWithAgent.mockResolvedValue(executions);

      const result = await service.getExecutionsByOrder(testUserId, testOrderId);

      expect(result).toHaveLength(2);
      expect(result[0].agent?.name).toBe('Test Agent 1');
      expect(result[1].agent?.name).toBe('Test Agent 2');
    });

    it('should allow creator access even when providerId is null', async () => {
      const orderWithNullProvider: OrderInfo = {
        ...mockOrder,
        providerId: null,
      };
      mockRepository.findOrderById.mockResolvedValue(orderWithNullProvider);
      mockRepository.findExecutionsByOrderIdWithAgent.mockResolvedValue([mockExecutionWithAgent]);

      const result = await service.getExecutionsByOrder(testUserId, testOrderId);

      expect(result).toHaveLength(1);
    });
  });

  // ============================================================
  // refreshExecutionStatus
  // ============================================================

  describe('refreshExecutionStatus', () => {
    it('should return execution when found', async () => {
      mockRepository.findExecutionById.mockResolvedValue(mockExecution);

      const result = await service.refreshExecutionStatus(testExecutionId1);

      expect(result).toEqual(mockExecution);
      expect(mockRepository.findExecutionById).toHaveBeenCalledWith(testExecutionId1);
    });

    it('should throw 404 if execution not found', async () => {
      mockRepository.findExecutionById.mockResolvedValue(null);

      await expectHttpErrorCode(
        service.refreshExecutionStatus('non-existent-execution'),
        404,
        ErrorCode.BUSINESS_RESOURCE_NOT_FOUND
      );
    });

    // Note: The current implementation is a placeholder that just returns the execution.
    // When MastraClientService is available, additional tests for status refresh logic
    // should be added here.
  });

  // ============================================================
  // selectExecutions
  // ============================================================

  describe('selectExecutions', () => {
    const selectingOrder: OrderInfo = {
      ...mockOrder,
      status: 'Selecting',
      executionPhase: 'selecting',
    };

    const completedExecution1: Execution = {
      ...mockExecution,
      id: testExecutionId1,
      status: 'completed',
    };

    const completedExecution2: Execution = {
      ...mockExecution,
      id: testExecutionId2,
      agentId: testAgentId2,
      status: 'completed',
    };

    const completedExecution3: Execution = {
      ...mockExecution,
      id: testExecutionId3,
      agentId: 'agent-3333',
      status: 'completed',
    };

    it('should mark selected executions and reject others', async () => {
      mockRepository.findOrderById.mockResolvedValue(selectingOrder);
      mockRepository.findExecutionsByOrderId.mockResolvedValue([
        completedExecution1,
        completedExecution2,
        completedExecution3,
      ]);
      mockRepository.updateExecutionsBatch
        .mockResolvedValueOnce([{ ...completedExecution1, status: 'selected' }])
        .mockResolvedValueOnce([
          { ...completedExecution2, status: 'rejected' },
          { ...completedExecution3, status: 'rejected' },
        ]);

      const result = await service.selectExecutions(testUserId, {
        orderId: testOrderId,
        selectedExecutionIds: [testExecutionId1],
      });

      expect(result.selectedExecutions).toHaveLength(1);
      expect(result.selectedExecutions[0].id).toBe(testExecutionId1);
      expect(result.rejectedExecutions).toHaveLength(2);
      expect(mockRepository.updateExecutionsBatch).toHaveBeenCalledTimes(2);
      expect(mockRepository.updateExecutionsBatch).toHaveBeenCalledWith([testExecutionId1], {
        status: 'selected',
      });
      expect(mockRepository.updateExecutionsBatch).toHaveBeenCalledWith(
        [testExecutionId2, testExecutionId3],
        { status: 'rejected' }
      );
    });

    it('should allow selecting multiple executions', async () => {
      mockRepository.findOrderById.mockResolvedValue(selectingOrder);
      mockRepository.findExecutionsByOrderId.mockResolvedValue([
        completedExecution1,
        completedExecution2,
        completedExecution3,
      ]);
      mockRepository.updateExecutionsBatch
        .mockResolvedValueOnce([
          { ...completedExecution1, status: 'selected' },
          { ...completedExecution2, status: 'selected' },
        ])
        .mockResolvedValueOnce([{ ...completedExecution3, status: 'rejected' }]);

      const result = await service.selectExecutions(testUserId, {
        orderId: testOrderId,
        selectedExecutionIds: [testExecutionId1, testExecutionId2],
      });

      expect(result.selectedExecutions).toHaveLength(2);
      expect(result.rejectedExecutions).toHaveLength(1);
    });

    it('should allow selecting zero executions (reject all)', async () => {
      mockRepository.findOrderById.mockResolvedValue(selectingOrder);
      mockRepository.findExecutionsByOrderId.mockResolvedValue([
        completedExecution1,
        completedExecution2,
      ]);
      mockRepository.updateExecutionsBatch.mockResolvedValueOnce([
        { ...completedExecution1, status: 'rejected' },
        { ...completedExecution2, status: 'rejected' },
      ]);

      const result = await service.selectExecutions(testUserId, {
        orderId: testOrderId,
        selectedExecutionIds: [],
      });

      expect(result.selectedExecutions).toHaveLength(0);
      expect(result.rejectedExecutions).toHaveLength(2);
      // Only one call for rejecting, no call for selecting
      expect(mockRepository.updateExecutionsBatch).toHaveBeenCalledTimes(1);
      expect(mockRepository.updateExecutionsBatch).toHaveBeenCalledWith(
        [testExecutionId1, testExecutionId2],
        { status: 'rejected' }
      );
    });

    it('should throw 404 if order not found', async () => {
      mockRepository.findOrderById.mockResolvedValue(null);

      await expectHttpErrorCode(
        service.selectExecutions(testUserId, {
          orderId: testOrderId,
          selectedExecutionIds: [testExecutionId1],
        }),
        404,
        ErrorCode.BUSINESS_RESOURCE_NOT_FOUND
      );
    });

    it('should throw 403 if user is not order creator', async () => {
      mockRepository.findOrderById.mockResolvedValue(selectingOrder);

      await expectHttpErrorCode(
        service.selectExecutions(testUserId2, {
          orderId: testOrderId,
          selectedExecutionIds: [testExecutionId1],
        }),
        403,
        ErrorCode.AUTH_FORBIDDEN
      );
    });

    it('should throw ValidationError if order is not in selecting phase', async () => {
      const executingOrder: OrderInfo = {
        ...mockOrder,
        status: 'Executing',
        executionPhase: 'executing',
      };
      mockRepository.findOrderById.mockResolvedValue(executingOrder);

      await expect(
        service.selectExecutions(testUserId, {
          orderId: testOrderId,
          selectedExecutionIds: [testExecutionId1],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if no executions found for order', async () => {
      mockRepository.findOrderById.mockResolvedValue(selectingOrder);
      mockRepository.findExecutionsByOrderId.mockResolvedValue([]);

      await expect(
        service.selectExecutions(testUserId, {
          orderId: testOrderId,
          selectedExecutionIds: [testExecutionId1],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if selected execution does not belong to order', async () => {
      mockRepository.findOrderById.mockResolvedValue(selectingOrder);
      mockRepository.findExecutionsByOrderId.mockResolvedValue([completedExecution1]);

      const wrongExecutionId = 'wrong-exec-id';

      await expect(
        service.selectExecutions(testUserId, {
          orderId: testOrderId,
          selectedExecutionIds: [wrongExecutionId],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if selecting non-completed execution', async () => {
      const runningExecution: Execution = {
        ...mockExecution,
        id: testExecutionId1,
        status: 'running',
      };
      mockRepository.findOrderById.mockResolvedValue(selectingOrder);
      mockRepository.findExecutionsByOrderId.mockResolvedValue([runningExecution]);

      await expect(
        service.selectExecutions(testUserId, {
          orderId: testOrderId,
          selectedExecutionIds: [testExecutionId1],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should handle order with null executionPhase gracefully', async () => {
      const orderWithNullPhase: OrderInfo = {
        ...mockOrder,
        executionPhase: null,
      };
      mockRepository.findOrderById.mockResolvedValue(orderWithNullPhase);

      await expect(
        service.selectExecutions(testUserId, {
          orderId: testOrderId,
          selectedExecutionIds: [testExecutionId1],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should not reject executions that are not in completed status', async () => {
      const runningExecution: Execution = {
        ...mockExecution,
        id: testExecutionId2,
        status: 'running',
      };
      mockRepository.findOrderById.mockResolvedValue(selectingOrder);
      mockRepository.findExecutionsByOrderId.mockResolvedValue([
        completedExecution1,
        runningExecution, // This should not be rejected since it's still running
      ]);
      mockRepository.updateExecutionsBatch.mockResolvedValueOnce([
        { ...completedExecution1, status: 'selected' },
      ]);

      const result = await service.selectExecutions(testUserId, {
        orderId: testOrderId,
        selectedExecutionIds: [testExecutionId1],
      });

      expect(result.selectedExecutions).toHaveLength(1);
      // Running execution should not be in rejected list
      expect(result.rejectedExecutions).toHaveLength(0);
      // Only one call for selecting
      expect(mockRepository.updateExecutionsBatch).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // Edge cases
  // ============================================================

  describe('edge cases', () => {
    it('should handle execution with null agent', async () => {
      const executionWithNullAgent: ExecutionWithAgent = {
        ...mockExecution,
        agent: null,
      };
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.findExecutionsByOrderIdWithAgent.mockResolvedValue([executionWithNullAgent]);

      const result = await service.getExecutionsByOrder(testUserId, testOrderId);

      expect(result).toHaveLength(1);
      expect(result[0].agent).toBeNull();
    });

    it('should handle execution with all optional fields null', async () => {
      const minimalExecution: Execution = {
        id: testExecutionId1,
        orderId: testOrderId,
        agentId: testAgentId1,
        status: 'pending',
        mastraRunId: null,
        mastraStatus: null,
        resultPreview: null,
        resultContent: null,
        resultUrl: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        createdAt: '2026-01-24T00:00:00.000Z',
        updatedAt: '2026-01-24T00:00:00.000Z',
      };
      mockRepository.findExecutionById.mockResolvedValue(minimalExecution);

      const result = await service.refreshExecutionStatus(testExecutionId1);

      expect(result).toEqual(minimalExecution);
    });
  });
});
