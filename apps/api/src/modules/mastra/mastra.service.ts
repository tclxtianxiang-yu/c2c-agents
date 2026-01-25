import { Inject, Injectable, Logger } from '@nestjs/common';
import { AgentRepository } from '../agent/agent.repository';
import { MastraTokenService } from '../mastra-token/mastra-token.service';

export type MastraExecuteParams = {
  agentId: string;
  taskDescription: string;
  taskType: string;
  attachments?: string[];
};

export type MastraExecuteResult = {
  runId: string;
  status: 'running' | 'completed' | 'failed';
  preview?: string;
  content?: string;
  url?: string;
  error?: string;
};

type MastraApiExecuteResponse = {
  runId: string;
  status: 'running' | 'completed' | 'failed';
  preview?: string;
  content?: string;
  url?: string;
  error?: string;
};

type MastraApiRunStatusResponse = {
  runId: string;
  status: 'running' | 'completed' | 'failed';
  preview?: string;
  content?: string;
  url?: string;
  error?: string;
};

@Injectable()
export class MastraService {
  private readonly logger = new Logger(MastraService.name);

  constructor(
    @Inject(MastraTokenService) private readonly tokenService: MastraTokenService,
    @Inject(AgentRepository) private readonly agentRepository: AgentRepository
  ) {}

  /**
   * Validates that an Agent has a valid Mastra Token configured
   */
  async validateAgentToken(agentId: string): Promise<{ valid: boolean; error?: string }> {
    // 1. Find the Agent
    const agent = await this.agentRepository.findAgentById(agentId);
    if (!agent) {
      return { valid: false, error: 'Agent not found' };
    }

    // 2. Check if mastraTokenId and mastraUrl are configured
    if (!agent.mastraUrl) {
      return { valid: false, error: 'Agent does not have a Mastra URL configured' };
    }

    if (!agent.mastraTokenId) {
      return { valid: false, error: 'Agent does not have a Mastra Token configured' };
    }

    // 3. Get the token and validate it exists
    const token = await this.tokenService.getTokenForAgent(agent.mastraTokenId);
    if (!token) {
      return { valid: false, error: 'Mastra Token not found or has been deleted' };
    }

    return { valid: true };
  }

  /**
   * Calls Mastra Agent to execute a task
   */
  async executeTask(params: MastraExecuteParams): Promise<MastraExecuteResult> {
    const { agentId, taskDescription, taskType, attachments } = params;

    // 1. Get Agent and Token
    const agent = await this.agentRepository.findAgentById(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    if (!agent.mastraUrl) {
      throw new Error(`Agent ${agentId} does not have a Mastra URL configured`);
    }

    if (!agent.mastraTokenId) {
      throw new Error(`Agent ${agentId} does not have a Mastra Token configured`);
    }

    const token = await this.tokenService.getTokenForAgent(agent.mastraTokenId);
    if (!token) {
      throw new Error(`Mastra Token not found for agent ${agentId}`);
    }

    // 2. Call Mastra Cloud API: POST {agent.mastraUrl}/api/agents/execute
    const executeUrl = `${agent.mastraUrl}/api/agents/execute`;

    this.logger.log(`Executing task for agent ${agentId} at ${executeUrl}`);

    try {
      const response = await fetch(executeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.token}`,
        },
        body: JSON.stringify({
          taskDescription,
          taskType,
          attachments: attachments ?? [],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Mastra API error for agent ${agentId}: ${response.status} - ${errorText}`
        );
        return {
          runId: '',
          status: 'failed',
          error: `Mastra API returned ${response.status}: ${errorText}`,
        };
      }

      const data = (await response.json()) as MastraApiExecuteResponse;

      this.logger.log(`Task execution started for agent ${agentId}, runId: ${data.runId}`);

      // 3. Return runId and initial status
      return {
        runId: data.runId,
        status: data.status,
        preview: data.preview,
        content: data.content,
        url: data.url,
        error: data.error,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to execute task for agent ${agentId}: ${message}`);
      return {
        runId: '',
        status: 'failed',
        error: `Failed to call Mastra API: ${message}`,
      };
    }
  }

  /**
   * Queries Mastra execution status
   */
  async getExecutionStatus(agentId: string, runId: string): Promise<MastraExecuteResult> {
    // 1. Get Agent and Token
    const agent = await this.agentRepository.findAgentById(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    if (!agent.mastraUrl) {
      throw new Error(`Agent ${agentId} does not have a Mastra URL configured`);
    }

    if (!agent.mastraTokenId) {
      throw new Error(`Agent ${agentId} does not have a Mastra Token configured`);
    }

    const token = await this.tokenService.getTokenForAgent(agent.mastraTokenId);
    if (!token) {
      throw new Error(`Mastra Token not found for agent ${agentId}`);
    }

    // 2. Call Mastra Cloud API: GET {agent.mastraUrl}/api/runs/{runId}
    const statusUrl = `${agent.mastraUrl}/api/runs/${runId}`;

    this.logger.debug(`Checking execution status for agent ${agentId}, runId: ${runId}`);

    try {
      const response = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token.token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Mastra API error when checking status for agent ${agentId}, runId ${runId}: ${response.status} - ${errorText}`
        );
        return {
          runId,
          status: 'failed',
          error: `Mastra API returned ${response.status}: ${errorText}`,
        };
      }

      const data = (await response.json()) as MastraApiRunStatusResponse;

      // 3. Return current status and result
      return {
        runId: data.runId,
        status: data.status,
        preview: data.preview,
        content: data.content,
        url: data.url,
        error: data.error,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to get execution status for agent ${agentId}, runId ${runId}: ${message}`
      );
      return {
        runId,
        status: 'failed',
        error: `Failed to call Mastra API: ${message}`,
      };
    }
  }
}
