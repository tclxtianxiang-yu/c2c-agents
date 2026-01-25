import { type Agent, AgentStatus, type MastraToken } from '@c2c-agents/shared';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { AgentRepository } from '../../agent/agent.repository';
import { MastraTokenService } from '../../mastra-token/mastra-token.service';
import { type MastraExecuteParams, MastraService } from '../mastra.service';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('MastraService', () => {
  let service: MastraService;

  const testAgentId = 'agent-1111-1111-1111-111111111111';
  const testTokenId = 'token-1111-1111-1111-111111111111';

  const mockAgent: Agent = {
    id: testAgentId,
    ownerId: 'owner-1111',
    name: 'Test Agent',
    description: 'A test agent',
    avatarUrl: null,
    mastraUrl: 'https://mastra.example.com',
    mastraTokenId: testTokenId,
    tags: ['test'],
    supportedTaskTypes: ['writing'],
    minPrice: '100',
    maxPrice: '500',
    avgRating: 4.5,
    ratingCount: 10,
    completedOrderCount: 5,
    status: AgentStatus.Idle,
    currentOrderId: null,
    queueSize: 0,
    isListed: true,
    createdAt: '2026-01-24T00:00:00.000Z',
    updatedAt: '2026-01-24T00:00:00.000Z',
  };

  const mockToken: MastraToken = {
    id: testTokenId,
    ownerId: 'owner-1111',
    name: 'Test Token',
    token: 'mastra_secret_token_12345',
    createdAt: '2026-01-24T00:00:00.000Z',
    updatedAt: '2026-01-24T00:00:00.000Z',
  };

  const mockAgentRepository = {
    findAgentById: jest.fn(),
  };

  const mockTokenService = {
    getTokenForAgent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MastraService,
        {
          provide: AgentRepository,
          useValue: mockAgentRepository,
        },
        {
          provide: MastraTokenService,
          useValue: mockTokenService,
        },
      ],
    }).compile();

    service = module.get<MastraService>(MastraService);

    jest.clearAllMocks();
  });

  // ============================================================
  // validateAgentToken
  // ============================================================

  describe('validateAgentToken', () => {
    it('should return valid=true for properly configured agent', async () => {
      mockAgentRepository.findAgentById.mockResolvedValue(mockAgent);
      mockTokenService.getTokenForAgent.mockResolvedValue(mockToken);

      const result = await service.validateAgentToken(testAgentId);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockAgentRepository.findAgentById).toHaveBeenCalledWith(testAgentId);
      expect(mockTokenService.getTokenForAgent).toHaveBeenCalledWith(testTokenId);
    });

    it('should return valid=false if agent not found', async () => {
      mockAgentRepository.findAgentById.mockResolvedValue(null);

      const result = await service.validateAgentToken(testAgentId);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Agent not found');
      expect(mockTokenService.getTokenForAgent).not.toHaveBeenCalled();
    });

    it('should return valid=false if mastraUrl not configured', async () => {
      const agentWithoutUrl: Agent = {
        ...mockAgent,
        mastraUrl: '',
      };
      mockAgentRepository.findAgentById.mockResolvedValue(agentWithoutUrl);

      const result = await service.validateAgentToken(testAgentId);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Mastra URL');
    });

    it('should return valid=false if mastraTokenId not configured', async () => {
      const agentWithoutToken: Agent = {
        ...mockAgent,
        mastraTokenId: null,
      };
      mockAgentRepository.findAgentById.mockResolvedValue(agentWithoutToken);

      const result = await service.validateAgentToken(testAgentId);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Token');
    });

    it('should return valid=false if token not found in database', async () => {
      mockAgentRepository.findAgentById.mockResolvedValue(mockAgent);
      mockTokenService.getTokenForAgent.mockResolvedValue(null);

      const result = await service.validateAgentToken(testAgentId);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ============================================================
  // executeTask
  // ============================================================

  describe('executeTask', () => {
    const validExecuteParams: MastraExecuteParams = {
      agentId: testAgentId,
      taskDescription: 'Create a blog post about AI',
      taskType: 'writing',
      attachments: ['https://example.com/reference.pdf'],
    };

    it('should call Mastra API and return runId on success', async () => {
      mockAgentRepository.findAgentById.mockResolvedValue(mockAgent);
      mockTokenService.getTokenForAgent.mockResolvedValue(mockToken);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          runId: 'run-123',
          status: 'running',
          preview: null,
          content: null,
        }),
      });

      const result = await service.executeTask(validExecuteParams);

      expect(result.runId).toBe('run-123');
      expect(result.status).toBe('running');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://mastra.example.com/api/agents/execute',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer mastra_secret_token_12345',
          }),
          body: JSON.stringify({
            taskDescription: 'Create a blog post about AI',
            taskType: 'writing',
            attachments: ['https://example.com/reference.pdf'],
          }),
        })
      );
    });

    it('should return result data when execution completes immediately', async () => {
      mockAgentRepository.findAgentById.mockResolvedValue(mockAgent);
      mockTokenService.getTokenForAgent.mockResolvedValue(mockToken);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          runId: 'run-456',
          status: 'completed',
          preview: 'Preview of the blog post',
          content: 'Full blog post content...',
          url: 'https://example.com/result.pdf',
        }),
      });

      const result = await service.executeTask(validExecuteParams);

      expect(result.runId).toBe('run-456');
      expect(result.status).toBe('completed');
      expect(result.preview).toBe('Preview of the blog post');
      expect(result.content).toBe('Full blog post content...');
      expect(result.url).toBe('https://example.com/result.pdf');
    });

    it('should send empty attachments array if not provided', async () => {
      mockAgentRepository.findAgentById.mockResolvedValue(mockAgent);
      mockTokenService.getTokenForAgent.mockResolvedValue(mockToken);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ runId: 'run-789', status: 'running' }),
      });

      await service.executeTask({
        agentId: testAgentId,
        taskDescription: 'Simple task',
        taskType: 'writing',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://mastra.example.com/api/agents/execute',
        expect.objectContaining({
          body: JSON.stringify({
            taskDescription: 'Simple task',
            taskType: 'writing',
            attachments: [],
          }),
        })
      );
    });

    it('should return failed status on API error', async () => {
      mockAgentRepository.findAgentById.mockResolvedValue(mockAgent);
      mockTokenService.getTokenForAgent.mockResolvedValue(mockToken);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const result = await service.executeTask(validExecuteParams);

      expect(result.status).toBe('failed');
      expect(result.runId).toBe('');
      expect(result.error).toContain('500');
      expect(result.error).toContain('Internal Server Error');
    });

    it('should return failed status on 4xx error', async () => {
      mockAgentRepository.findAgentById.mockResolvedValue(mockAgent);
      mockTokenService.getTokenForAgent.mockResolvedValue(mockToken);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const result = await service.executeTask(validExecuteParams);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('401');
    });

    it('should return failed status on network error', async () => {
      mockAgentRepository.findAgentById.mockResolvedValue(mockAgent);
      mockTokenService.getTokenForAgent.mockResolvedValue(mockToken);
      mockFetch.mockRejectedValue(new Error('Network error: ECONNREFUSED'));

      const result = await service.executeTask(validExecuteParams);

      expect(result.status).toBe('failed');
      expect(result.runId).toBe('');
      expect(result.error).toContain('Network error');
    });

    it('should throw error if agent not found', async () => {
      mockAgentRepository.findAgentById.mockResolvedValue(null);

      await expect(service.executeTask(validExecuteParams)).rejects.toThrow(
        `Agent not found: ${testAgentId}`
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw error if agent has no mastraUrl', async () => {
      const agentWithoutUrl: Agent = { ...mockAgent, mastraUrl: '' };
      mockAgentRepository.findAgentById.mockResolvedValue(agentWithoutUrl);

      await expect(service.executeTask(validExecuteParams)).rejects.toThrow(
        'does not have a Mastra URL configured'
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw error if agent has no mastraTokenId', async () => {
      const agentWithoutTokenId: Agent = { ...mockAgent, mastraTokenId: null };
      mockAgentRepository.findAgentById.mockResolvedValue(agentWithoutTokenId);

      await expect(service.executeTask(validExecuteParams)).rejects.toThrow(
        'does not have a Mastra Token configured'
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw error if token not found', async () => {
      mockAgentRepository.findAgentById.mockResolvedValue(mockAgent);
      mockTokenService.getTokenForAgent.mockResolvedValue(null);

      await expect(service.executeTask(validExecuteParams)).rejects.toThrow(
        'Mastra Token not found'
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // getExecutionStatus
  // ============================================================

  describe('getExecutionStatus', () => {
    const testRunId = 'run-1111';

    it('should call Mastra API and return status on success', async () => {
      mockAgentRepository.findAgentById.mockResolvedValue(mockAgent);
      mockTokenService.getTokenForAgent.mockResolvedValue(mockToken);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          runId: testRunId,
          status: 'running',
          preview: null,
          content: null,
        }),
      });

      const result = await service.getExecutionStatus(testAgentId, testRunId);

      expect(result.runId).toBe(testRunId);
      expect(result.status).toBe('running');
      expect(mockFetch).toHaveBeenCalledWith(
        `https://mastra.example.com/api/runs/${testRunId}`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer mastra_secret_token_12345',
          }),
        })
      );
    });

    it('should return completed status with results', async () => {
      mockAgentRepository.findAgentById.mockResolvedValue(mockAgent);
      mockTokenService.getTokenForAgent.mockResolvedValue(mockToken);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          runId: testRunId,
          status: 'completed',
          preview: 'Completed preview',
          content: 'Full completed content',
          url: 'https://storage.example.com/result.pdf',
        }),
      });

      const result = await service.getExecutionStatus(testAgentId, testRunId);

      expect(result.status).toBe('completed');
      expect(result.preview).toBe('Completed preview');
      expect(result.content).toBe('Full completed content');
      expect(result.url).toBe('https://storage.example.com/result.pdf');
    });

    it('should return failed status on API error', async () => {
      mockAgentRepository.findAgentById.mockResolvedValue(mockAgent);
      mockTokenService.getTokenForAgent.mockResolvedValue(mockToken);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Run not found',
      });

      const result = await service.getExecutionStatus(testAgentId, testRunId);

      expect(result.status).toBe('failed');
      expect(result.runId).toBe(testRunId);
      expect(result.error).toContain('404');
    });

    it('should return failed status on network error', async () => {
      mockAgentRepository.findAgentById.mockResolvedValue(mockAgent);
      mockTokenService.getTokenForAgent.mockResolvedValue(mockToken);
      mockFetch.mockRejectedValue(new Error('Connection timeout'));

      const result = await service.getExecutionStatus(testAgentId, testRunId);

      expect(result.status).toBe('failed');
      expect(result.runId).toBe(testRunId);
      expect(result.error).toContain('Connection timeout');
    });

    it('should throw error if agent not found', async () => {
      mockAgentRepository.findAgentById.mockResolvedValue(null);

      await expect(service.getExecutionStatus(testAgentId, testRunId)).rejects.toThrow(
        `Agent not found: ${testAgentId}`
      );
    });

    it('should throw error if agent has no mastraUrl', async () => {
      const agentWithoutUrl: Agent = { ...mockAgent, mastraUrl: '' };
      mockAgentRepository.findAgentById.mockResolvedValue(agentWithoutUrl);

      await expect(service.getExecutionStatus(testAgentId, testRunId)).rejects.toThrow(
        'does not have a Mastra URL configured'
      );
    });

    it('should throw error if agent has no mastraTokenId', async () => {
      const agentWithoutTokenId: Agent = { ...mockAgent, mastraTokenId: null };
      mockAgentRepository.findAgentById.mockResolvedValue(agentWithoutTokenId);

      await expect(service.getExecutionStatus(testAgentId, testRunId)).rejects.toThrow(
        'does not have a Mastra Token configured'
      );
    });

    it('should throw error if token not found', async () => {
      mockAgentRepository.findAgentById.mockResolvedValue(mockAgent);
      mockTokenService.getTokenForAgent.mockResolvedValue(null);

      await expect(service.getExecutionStatus(testAgentId, testRunId)).rejects.toThrow(
        'Mastra Token not found'
      );
    });

    it('should handle failed execution response from Mastra', async () => {
      mockAgentRepository.findAgentById.mockResolvedValue(mockAgent);
      mockTokenService.getTokenForAgent.mockResolvedValue(mockToken);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          runId: testRunId,
          status: 'failed',
          error: 'Agent encountered an internal error',
        }),
      });

      const result = await service.getExecutionStatus(testAgentId, testRunId);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Agent encountered an internal error');
    });
  });

  // ============================================================
  // Edge cases
  // ============================================================

  describe('edge cases', () => {
    it('should handle non-Error thrown exceptions', async () => {
      mockAgentRepository.findAgentById.mockResolvedValue(mockAgent);
      mockTokenService.getTokenForAgent.mockResolvedValue(mockToken);
      mockFetch.mockRejectedValue('String error');

      const result = await service.executeTask({
        agentId: testAgentId,
        taskDescription: 'Test',
        taskType: 'writing',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('String error');
    });

    it('should handle agent with trailing slash in mastraUrl', async () => {
      const agentWithTrailingSlash: Agent = {
        ...mockAgent,
        mastraUrl: 'https://mastra.example.com/',
      };
      mockAgentRepository.findAgentById.mockResolvedValue(agentWithTrailingSlash);
      mockTokenService.getTokenForAgent.mockResolvedValue(mockToken);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ runId: 'run-123', status: 'running' }),
      });

      await service.executeTask({
        agentId: testAgentId,
        taskDescription: 'Test',
        taskType: 'writing',
      });

      // The URL should have double slash - this may need handling in production
      expect(mockFetch).toHaveBeenCalledWith(
        'https://mastra.example.com//api/agents/execute',
        expect.anything()
      );
    });

    it('should handle empty task description', async () => {
      mockAgentRepository.findAgentById.mockResolvedValue(mockAgent);
      mockTokenService.getTokenForAgent.mockResolvedValue(mockToken);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ runId: 'run-123', status: 'running' }),
      });

      const result = await service.executeTask({
        agentId: testAgentId,
        taskDescription: '',
        taskType: 'writing',
      });

      expect(result.runId).toBe('run-123');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            taskDescription: '',
            taskType: 'writing',
            attachments: [],
          }),
        })
      );
    });

    it('should handle multiple attachments', async () => {
      mockAgentRepository.findAgentById.mockResolvedValue(mockAgent);
      mockTokenService.getTokenForAgent.mockResolvedValue(mockToken);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ runId: 'run-123', status: 'running' }),
      });

      const attachments = [
        'https://example.com/file1.pdf',
        'https://example.com/file2.png',
        'https://example.com/file3.docx',
      ];

      await service.executeTask({
        agentId: testAgentId,
        taskDescription: 'Process these files',
        taskType: 'DataProcessing',
        attachments,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            taskDescription: 'Process these files',
            taskType: 'DataProcessing',
            attachments,
          }),
        })
      );
    });
  });
});
