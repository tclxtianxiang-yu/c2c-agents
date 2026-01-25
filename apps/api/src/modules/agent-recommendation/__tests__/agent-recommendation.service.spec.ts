import { AgentStatus } from '@c2c-agents/shared';
import { Test, type TestingModule } from '@nestjs/testing';
import { AgentRepository } from '../../agent/agent.repository';
import { AgentEmbeddingService } from '../../agent-embedding/agent-embedding.service';
import { AgentRecommendationService } from '../agent-recommendation.service';

describe('AgentRecommendationService', () => {
  let service: AgentRecommendationService;

  const mockAgentEmbeddingService = {
    searchAgentsByTask: jest.fn(),
    isEnabled: jest.fn().mockReturnValue(true),
  };

  const mockAgentRepository = {
    findAgentById: jest.fn(),
  };

  const createMockAgent = (id: string, overrides = {}) => ({
    id,
    ownerId: 'user-1',
    name: `Agent ${id}`,
    description: `Description for ${id}`,
    avatarUrl: null,
    mastraUrl: 'https://mastra.cloud/agent/test',
    mastraTokenId: null,
    tags: ['test'],
    supportedTaskTypes: ['writing' as const],
    minPrice: '1000000',
    maxPrice: '10000000',
    avgRating: 4.0,
    ratingCount: 10,
    completedOrderCount: 5,
    status: AgentStatus.Idle,
    currentOrderId: null,
    queueSize: 0,
    isListed: true,
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentRecommendationService,
        { provide: AgentEmbeddingService, useValue: mockAgentEmbeddingService },
        { provide: AgentRepository, useValue: mockAgentRepository },
      ],
    }).compile();

    service = module.get<AgentRecommendationService>(AgentRecommendationService);
    jest.clearAllMocks();
  });

  describe('recommendAgentsForTask', () => {
    const mockTask = {
      title: 'Build a website',
      description: 'Create a landing page',
      type: 'website',
      tags: ['web'],
      expectedReward: '5000000',
    };

    it('should return empty result when no matches found', async () => {
      mockAgentEmbeddingService.searchAgentsByTask.mockResolvedValue([]);

      const result = await service.recommendAgentsForTask(mockTask);

      expect(result).toEqual({ candidates: [], recommended: [] });
    });

    it('should filter agents by price range', async () => {
      mockAgentEmbeddingService.searchAgentsByTask.mockResolvedValue([
        { agentId: 'agent-1', similarity: 0.9 },
        { agentId: 'agent-2', similarity: 0.8 },
      ]);

      // agent-1 price range includes task reward, agent-2 does not
      mockAgentRepository.findAgentById.mockImplementation((id: string) => {
        if (id === 'agent-1') {
          return Promise.resolve(createMockAgent('agent-1'));
        }
        if (id === 'agent-2') {
          return Promise.resolve(
            createMockAgent('agent-2', {
              minPrice: '100000000', // Too high
              maxPrice: '200000000',
            })
          );
        }
        return Promise.resolve(null);
      });

      const result = await service.recommendAgentsForTask(mockTask);

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].agent.id).toBe('agent-1');
    });

    it('should return at most 3 recommended agents', async () => {
      const matches = Array.from({ length: 10 }, (_, i) => ({
        agentId: `agent-${i}`,
        similarity: 0.9 - i * 0.05,
      }));
      mockAgentEmbeddingService.searchAgentsByTask.mockResolvedValue(matches);

      mockAgentRepository.findAgentById.mockImplementation((id: string) => {
        return Promise.resolve(createMockAgent(id));
      });

      const result = await service.recommendAgentsForTask(mockTask);

      expect(result.recommended).toHaveLength(3);
      expect(result.candidates).toHaveLength(10);
    });

    it('should exclude unlisted agents', async () => {
      mockAgentEmbeddingService.searchAgentsByTask.mockResolvedValue([
        { agentId: 'agent-1', similarity: 0.9 },
        { agentId: 'agent-2', similarity: 0.8 },
      ]);

      mockAgentRepository.findAgentById.mockImplementation((id: string) => {
        if (id === 'agent-1') {
          return Promise.resolve(createMockAgent('agent-1'));
        }
        if (id === 'agent-2') {
          return Promise.resolve(createMockAgent('agent-2', { isListed: false }));
        }
        return Promise.resolve(null);
      });

      const result = await service.recommendAgentsForTask(mockTask);

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].agent.id).toBe('agent-1');
    });

    it('should include similarity and score in result', async () => {
      mockAgentEmbeddingService.searchAgentsByTask.mockResolvedValue([
        { agentId: 'agent-1', similarity: 0.9 },
      ]);
      mockAgentRepository.findAgentById.mockResolvedValue(createMockAgent('agent-1'));

      const result = await service.recommendAgentsForTask(mockTask);

      expect(result.candidates[0].similarity).toBe(0.9);
      expect(result.candidates[0].score).toBeGreaterThan(0);
    });
  });
});
