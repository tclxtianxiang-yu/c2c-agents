import { AgentStatus, ValidationError } from '@c2c-agents/shared';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { AgentEmbeddingService } from '../../agent-embedding/agent-embedding.service';
import { MastraTokenService } from '../../mastra-token/mastra-token.service';
import { AgentRepository } from '../agent.repository';
import { AgentService } from '../agent.service';

describe('AgentService', () => {
  let service: AgentService;

  const mockRepository = {
    createAgent: jest.fn(),
    findAgentById: jest.fn(),
    findAgentsByOwnerId: jest.fn(),
    updateAgent: jest.fn(),
    listAgents: jest.fn(),
    getQueuedItemCount: jest.fn(),
    hasInProgressOrder: jest.fn(),
    batchGetAgentStatusData: jest.fn(),
  };

  const mockMastraTokenService = {
    getToken: jest.fn(),
  };

  const mockAgentEmbeddingService = {
    updateAgentEmbedding: jest.fn(),
    deleteAgentEmbedding: jest.fn(),
    searchAgentsByTask: jest.fn(),
    isEnabled: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        {
          provide: AgentRepository,
          useValue: mockRepository,
        },
        {
          provide: MastraTokenService,
          useValue: mockMastraTokenService,
        },
        {
          provide: AgentEmbeddingService,
          useValue: mockAgentEmbeddingService,
        },
      ],
    }).compile();

    service = module.get<AgentService>(AgentService);

    jest.clearAllMocks();
  });

  describe('createAgent', () => {
    const validCreateInput = {
      name: 'Test Agent',
      description: 'Test Description',
      mastraUrl: 'https://mastra.cloud/agent/test',
      supportedTaskTypes: ['writing'] as const,
      minPrice: '1000000',
      maxPrice: '10000000',
    };

    it('should create agent successfully', async () => {
      const mockAgent = {
        id: 'agent-1',
        ownerId: 'user-1',
        name: validCreateInput.name,
        description: validCreateInput.description,
        avatarUrl: null,
        mastraUrl: validCreateInput.mastraUrl,
        tags: [],
        supportedTaskTypes: validCreateInput.supportedTaskTypes,
        minPrice: validCreateInput.minPrice,
        maxPrice: validCreateInput.maxPrice,
        avgRating: 0,
        ratingCount: 0,
        completedOrderCount: 0,
        status: AgentStatus.Idle,
        currentOrderId: null,
        queueSize: 0,
        isListed: true,
        createdAt: '2026-01-15T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z',
      };

      mockRepository.createAgent.mockResolvedValue(mockAgent);

      const result = await service.createAgent('user-1', validCreateInput);

      expect(result).toEqual(mockAgent);
      expect(mockRepository.createAgent).toHaveBeenCalledWith({
        ownerId: 'user-1',
        name: validCreateInput.name,
        description: validCreateInput.description,
        avatarUrl: undefined,
        mastraUrl: validCreateInput.mastraUrl,
        mastraTokenId: undefined,
        tags: [],
        supportedTaskTypes: validCreateInput.supportedTaskTypes,
        minPrice: validCreateInput.minPrice,
        maxPrice: validCreateInput.maxPrice,
      });
      expect(mockAgentEmbeddingService.updateAgentEmbedding).toHaveBeenCalledWith({
        id: mockAgent.id,
        name: mockAgent.name,
        description: mockAgent.description,
        tags: mockAgent.tags,
      });
    });

    it('should throw error if name is missing', async () => {
      await expect(
        service.createAgent('user-1', { ...validCreateInput, name: '' })
      ).rejects.toThrow(ValidationError);
      await expect(
        service.createAgent('user-1', { ...validCreateInput, name: '   ' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw error if description is missing', async () => {
      await expect(
        service.createAgent('user-1', { ...validCreateInput, description: '' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw error if mastraUrl is missing', async () => {
      await expect(
        service.createAgent('user-1', { ...validCreateInput, mastraUrl: '' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw error if supportedTaskTypes is empty', async () => {
      await expect(
        service.createAgent('user-1', { ...validCreateInput, supportedTaskTypes: [] })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw error if minPrice > maxPrice', async () => {
      await expect(
        service.createAgent('user-1', {
          ...validCreateInput,
          minPrice: '10000000',
          maxPrice: '1000000',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw error if minPrice is negative', async () => {
      await expect(
        service.createAgent('user-1', { ...validCreateInput, minPrice: '-1000' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw error if maxPrice is negative', async () => {
      await expect(
        service.createAgent('user-1', { ...validCreateInput, maxPrice: '-1000' })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw error if tags exceed 10', async () => {
      await expect(
        service.createAgent('user-1', {
          ...validCreateInput,
          tags: Array(11).fill('tag'),
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('updateAgent', () => {
    const mockAgent = {
      id: 'agent-1',
      ownerId: 'user-1',
      name: 'Test Agent',
      description: 'Test Description',
      avatarUrl: null,
      mastraUrl: 'https://mastra.cloud/agent/test',
      tags: [],
      supportedTaskTypes: ['writing'] as const,
      minPrice: '1000000',
      maxPrice: '10000000',
      avgRating: 0,
      ratingCount: 0,
      completedOrderCount: 0,
      status: AgentStatus.Idle,
      currentOrderId: null,
      queueSize: 0,
      isListed: true,
      createdAt: '2026-01-15T00:00:00.000Z',
      updatedAt: '2026-01-15T00:00:00.000Z',
    };

    it('should update agent successfully', async () => {
      mockRepository.findAgentById.mockResolvedValue(mockAgent);
      mockRepository.updateAgent.mockResolvedValue({
        ...mockAgent,
        name: 'Updated Agent',
      });
      mockRepository.hasInProgressOrder.mockResolvedValue(false);
      mockRepository.getQueuedItemCount.mockResolvedValue(0);

      const result = await service.updateAgent('user-1', 'agent-1', { name: 'Updated Agent' });

      expect(result.name).toBe('Updated Agent');
      expect(mockRepository.updateAgent).toHaveBeenCalledWith('agent-1', { name: 'Updated Agent' });
    });

    it('should throw error if agent not found', async () => {
      mockRepository.findAgentById.mockResolvedValue(null);

      await expect(service.updateAgent('user-1', 'agent-1', { name: 'Updated' })).rejects.toThrow(
        /Agent not found/
      );
    });

    it('should throw error if user is not agent owner', async () => {
      mockRepository.findAgentById.mockResolvedValue(mockAgent);

      await expect(service.updateAgent('user-2', 'agent-1', { name: 'Updated' })).rejects.toThrow(
        /does not belong to current user/
      );
    });

    it('should throw error if updated minPrice > maxPrice', async () => {
      mockRepository.findAgentById.mockResolvedValue(mockAgent);

      await expect(
        service.updateAgent('user-1', 'agent-1', {
          minPrice: '20000000',
          maxPrice: '5000000',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('computeAgentStatus', () => {
    it('should return Idle when no InProgress order and no queue', async () => {
      mockRepository.hasInProgressOrder.mockResolvedValue(false);
      mockRepository.getQueuedItemCount.mockResolvedValue(0);

      const status = await service.computeAgentStatus('agent-1');

      expect(status).toBe(AgentStatus.Idle);
    });

    it('should return Busy when has InProgress order but queue is empty', async () => {
      mockRepository.hasInProgressOrder.mockResolvedValue(true);
      mockRepository.getQueuedItemCount.mockResolvedValue(0);

      const status = await service.computeAgentStatus('agent-1');

      expect(status).toBe(AgentStatus.Busy);
    });

    it('should return Queueing when has InProgress order and queue is not empty', async () => {
      mockRepository.hasInProgressOrder.mockResolvedValue(true);
      mockRepository.getQueuedItemCount.mockResolvedValue(3);

      const status = await service.computeAgentStatus('agent-1');

      expect(status).toBe(AgentStatus.Queueing);
    });
  });

  describe('listAgents', () => {
    const mockAgents = [
      {
        id: 'agent-1',
        ownerId: 'user-1',
        name: 'Agent 1',
        description: 'Description 1',
        avatarUrl: null,
        mastraUrl: 'https://mastra.cloud/agent/1',
        mastraTokenId: null,
        tags: ['tag1'],
        supportedTaskTypes: ['writing'] as const,
        minPrice: '1000000',
        maxPrice: '10000000',
        avgRating: 4.5,
        ratingCount: 10,
        completedOrderCount: 5,
        status: AgentStatus.Idle,
        currentOrderId: null,
        queueSize: 0,
        isListed: true,
        createdAt: '2026-01-15T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z',
      },
    ];

    it('should list agents with computed status', async () => {
      mockRepository.listAgents.mockResolvedValue(mockAgents);
      mockRepository.batchGetAgentStatusData.mockResolvedValue(
        new Map([
          [
            'agent-1',
            {
              hasInProgress: false,
              queuedCount: 0,
            },
          ],
        ])
      );

      const result = await service.listAgents({});

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(AgentStatus.Idle);
    });

    it('should default to isListed=true', async () => {
      mockRepository.listAgents.mockResolvedValue([]);

      await service.listAgents({});

      expect(mockRepository.listAgents).toHaveBeenCalledWith({});
    });

    it('should support filtering by keyword', async () => {
      mockRepository.listAgents.mockResolvedValue([]);

      await service.listAgents({ keyword: 'test' });

      expect(mockRepository.listAgents).toHaveBeenCalledWith({ keyword: 'test' });
    });

    it('should support filtering by tags', async () => {
      mockRepository.listAgents.mockResolvedValue([]);

      await service.listAgents({ tags: ['tag1', 'tag2'] });

      expect(mockRepository.listAgents).toHaveBeenCalledWith({ tags: ['tag1', 'tag2'] });
    });

    it('should support filtering by taskType', async () => {
      mockRepository.listAgents.mockResolvedValue([]);

      await service.listAgents({ taskType: 'writing' });

      expect(mockRepository.listAgents).toHaveBeenCalledWith({ taskType: 'writing' });
    });

    it('should support filtering by price range', async () => {
      mockRepository.listAgents.mockResolvedValue([]);

      await service.listAgents({ minPrice: '1000000', maxPrice: '5000000' });

      expect(mockRepository.listAgents).toHaveBeenCalledWith({
        minPrice: '1000000',
        maxPrice: '5000000',
      });
    });
  });
});
