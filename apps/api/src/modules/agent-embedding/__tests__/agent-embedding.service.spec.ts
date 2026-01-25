import { Test, type TestingModule } from '@nestjs/testing';
import { EmbeddingService } from '../../embedding/embedding.service';
import { AgentEmbeddingRepository } from '../agent-embedding.repository';
import { AgentEmbeddingService } from '../agent-embedding.service';

describe('AgentEmbeddingService', () => {
  let service: AgentEmbeddingService;

  const mockRepository = {
    upsertEmbedding: jest.fn(),
    findByAgentId: jest.fn(),
    deleteByAgentId: jest.fn(),
    matchAgentsByEmbedding: jest.fn(),
  };

  const mockEmbeddingService = {
    isEnabled: jest.fn(),
    getModel: jest.fn(),
    generateEmbedding: jest.fn(),
    buildAgentEmbeddingText: jest.fn(),
    buildTaskEmbeddingText: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentEmbeddingService,
        { provide: AgentEmbeddingRepository, useValue: mockRepository },
        { provide: EmbeddingService, useValue: mockEmbeddingService },
      ],
    }).compile();

    service = module.get<AgentEmbeddingService>(AgentEmbeddingService);
    jest.clearAllMocks();
  });

  describe('isEnabled', () => {
    it('should delegate to EmbeddingService.isEnabled', () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      expect(service.isEnabled()).toBe(true);

      mockEmbeddingService.isEnabled.mockReturnValue(false);
      expect(service.isEnabled()).toBe(false);
    });
  });

  describe('updateAgentEmbedding', () => {
    const mockAgent = {
      id: 'agent-1',
      name: 'Test Agent',
      description: 'A test agent',
      tags: ['test', 'coding'],
    };

    it('should skip when embedding service is disabled', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(false);

      await service.updateAgentEmbedding(mockAgent);

      expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalled();
      expect(mockRepository.upsertEmbedding).not.toHaveBeenCalled();
    });

    it('should generate and store embedding when enabled', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.buildAgentEmbeddingText.mockReturnValue(
        'Name: Test Agent\nDescription: A test agent\nTags: test, coding'
      );
      mockEmbeddingService.generateEmbedding.mockResolvedValue({
        embedding: [0.1, 0.2, 0.3],
        model: 'text-embedding-3-small',
        usage: { promptTokens: 10, totalTokens: 10 },
      });
      mockRepository.upsertEmbedding.mockResolvedValue({});

      await service.updateAgentEmbedding(mockAgent);

      expect(mockEmbeddingService.buildAgentEmbeddingText).toHaveBeenCalledWith({
        name: mockAgent.name,
        description: mockAgent.description,
        tags: mockAgent.tags,
      });
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
        'Name: Test Agent\nDescription: A test agent\nTags: test, coding'
      );
      expect(mockRepository.upsertEmbedding).toHaveBeenCalledWith({
        agentId: 'agent-1',
        contentText: 'Name: Test Agent\nDescription: A test agent\nTags: test, coding',
        embedding: [0.1, 0.2, 0.3],
        modelId: 'text-embedding-3-small',
      });
    });

    it('should not throw when embedding generation fails', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.buildAgentEmbeddingText.mockReturnValue('text');
      mockEmbeddingService.generateEmbedding.mockRejectedValue(new Error('API error'));

      // Should not throw
      await expect(service.updateAgentEmbedding(mockAgent)).resolves.not.toThrow();
    });
  });

  describe('deleteAgentEmbedding', () => {
    it('should skip when embedding service is disabled', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(false);

      await service.deleteAgentEmbedding('agent-1');

      expect(mockRepository.deleteByAgentId).not.toHaveBeenCalled();
    });

    it('should delete embedding when enabled', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockRepository.deleteByAgentId.mockResolvedValue(undefined);

      await service.deleteAgentEmbedding('agent-1');

      expect(mockRepository.deleteByAgentId).toHaveBeenCalledWith('agent-1');
    });
  });

  describe('searchAgentsByTask', () => {
    const mockTask = {
      title: 'Build a website',
      description: 'Create a landing page',
      type: 'website',
      tags: ['web', 'frontend'],
    };

    it('should return empty array when embedding service is disabled', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(false);

      const result = await service.searchAgentsByTask(mockTask);

      expect(result).toEqual([]);
      expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalled();
    });

    it('should search and return matched agents', async () => {
      mockEmbeddingService.isEnabled.mockReturnValue(true);
      mockEmbeddingService.buildTaskEmbeddingText.mockReturnValue(
        'Title: Build a website\nDescription: Create a landing page\nType: website\nTags: web, frontend'
      );
      mockEmbeddingService.generateEmbedding.mockResolvedValue({
        embedding: [0.1, 0.2, 0.3],
        model: 'text-embedding-3-small',
        usage: { promptTokens: 15, totalTokens: 15 },
      });
      mockRepository.matchAgentsByEmbedding.mockResolvedValue([
        { agentId: 'agent-1', similarity: 0.95 },
        { agentId: 'agent-2', similarity: 0.85 },
      ]);

      const result = await service.searchAgentsByTask(mockTask);

      expect(result).toEqual([
        { agentId: 'agent-1', similarity: 0.95 },
        { agentId: 'agent-2', similarity: 0.85 },
      ]);
      expect(mockRepository.matchAgentsByEmbedding).toHaveBeenCalledWith([0.1, 0.2, 0.3], {
        matchThreshold: 0.3,
        matchCount: 15,
      });
    });
  });
});
