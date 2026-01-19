import { QUEUE_MAX_N } from '@c2c-agents/config/constants';
import { AgentStatus, OrderStatus, QueueItemStatus, TaskStatus } from '@c2c-agents/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../../../common/filters/http-exception.filter';
import { MatchingController } from '../matching.controller';
import { MatchingRepository } from '../matching.repository';
import { MatchingService } from '../matching.service';

describe('MatchingModule (e2e)', () => {
  let app: INestApplication;

  const testUserId = '11111111-1111-1111-1111-111111111111';
  const mockTask = {
    id: 'task-1',
    creator_id: testUserId,
    type: 'writing',
    expected_reward: '5000000',
    status: TaskStatus.Published,
    current_order_id: 'order-1',
    current_status: OrderStatus.Standby,
  };

  const mockOrder = {
    id: 'order-1',
    task_id: 'task-1',
    creator_id: testUserId,
    provider_id: null,
    agent_id: null,
    status: OrderStatus.Standby,
    pairing_created_at: null,
  };

  const mockIdleAgent = {
    id: 'agent-1',
    owner_id: 'provider-1',
    name: 'Test Idle Agent',
    description: 'Test description',
    tags: ['test'],
    supported_task_types: ['writing'],
    min_price: '1000000',
    max_price: '10000000',
    status: AgentStatus.Idle,
    avg_rating: 4.5,
    completed_order_count: 10,
    is_listed: true,
  };

  const mockBusyAgent = {
    ...mockIdleAgent,
    id: 'agent-2',
    name: 'Test Busy Agent',
    status: AgentStatus.Busy,
  };

  const mockRepository = {
    findTaskById: jest.fn(),
    findOrderById: jest.fn(),
    findAgentById: jest.fn(),
    listCandidateAgents: jest.fn(),
    getQueueCount: jest.fn(),
    findQueuedItem: jest.fn(),
    enqueueQueueItem: jest.fn(),
    listQueuedItems: jest.fn(),
    updateOrderPairing: jest.fn(),
    updateTaskCurrentStatus: jest.fn(),
    findActiveUserIdByAddress: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MatchingController],
      providers: [
        MatchingService,
        {
          provide: MatchingRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /matching/auto', () => {
    it('should return pairing result', async () => {
      mockRepository.findTaskById.mockResolvedValue(mockTask);
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.listCandidateAgents.mockResolvedValue([mockIdleAgent]);
      mockRepository.getQueueCount.mockResolvedValue(0);
      mockRepository.updateOrderPairing.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.Pairing,
      });
      mockRepository.updateTaskCurrentStatus.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .post('/matching/auto')
        .set('x-user-id', testUserId)
        .send({ taskId: mockTask.id })
        .expect(201);

      expect(response.body.result).toBe('pairing');
      expect(response.body.orderId).toBe(mockOrder.id);
    });

    it('should return 400 if x-user-id header is missing', async () => {
      await request(app.getHttpServer())
        .post('/matching/auto')
        .send({ taskId: mockTask.id })
        .expect(400);
    });

    it('should return 404 if taskId is invalid', async () => {
      mockRepository.findTaskById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/matching/auto')
        .set('x-user-id', testUserId)
        .send({ taskId: 'missing-task' })
        .expect(404);
    });
  });

  describe('POST /matching/manual', () => {
    it('should return queued result', async () => {
      mockRepository.findTaskById.mockResolvedValue(mockTask);
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.findAgentById.mockResolvedValue(mockBusyAgent);
      mockRepository.getQueueCount.mockResolvedValue(0);
      mockRepository.findQueuedItem.mockResolvedValue(null);
      mockRepository.enqueueQueueItem.mockResolvedValue({
        id: 'queue-1',
        agent_id: mockBusyAgent.id,
        order_id: mockOrder.id,
        status: QueueItemStatus.Queued,
        created_at: new Date().toISOString(),
      });
      mockRepository.listQueuedItems.mockResolvedValue([
        {
          id: 'queue-1',
          agent_id: mockBusyAgent.id,
          order_id: mockOrder.id,
          status: QueueItemStatus.Queued,
          created_at: new Date().toISOString(),
        },
      ]);

      const response = await request(app.getHttpServer())
        .post('/matching/manual')
        .set('x-user-id', testUserId)
        .send({ taskId: mockTask.id, agentId: mockBusyAgent.id })
        .expect(201);

      expect(response.body.result).toBe('queued');
      expect(response.body.queuePosition).toBe(1);
    });

    it('should return 400 if x-user-id header is missing', async () => {
      await request(app.getHttpServer())
        .post('/matching/manual')
        .send({ taskId: mockTask.id, agentId: mockBusyAgent.id })
        .expect(400);
    });

    it('should return 404 if agentId is invalid', async () => {
      mockRepository.findTaskById.mockResolvedValue(mockTask);
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.findAgentById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/matching/manual')
        .set('x-user-id', testUserId)
        .send({ taskId: mockTask.id, agentId: 'missing-agent' })
        .expect(404);
    });

    it('should return 400 if agent does not support task type', async () => {
      mockRepository.findTaskById.mockResolvedValue(mockTask);
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.findAgentById.mockResolvedValue({
        ...mockBusyAgent,
        supported_task_types: ['translation'],
      });

      await request(app.getHttpServer())
        .post('/matching/manual')
        .set('x-user-id', testUserId)
        .send({ taskId: mockTask.id, agentId: mockBusyAgent.id })
        .expect(400);
    });

    it('should return 400 if reward is out of range', async () => {
      mockRepository.findTaskById.mockResolvedValue(mockTask);
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.findAgentById.mockResolvedValue({
        ...mockBusyAgent,
        min_price: '6000000',
        max_price: '7000000',
      });

      await request(app.getHttpServer())
        .post('/matching/manual')
        .set('x-user-id', testUserId)
        .send({ taskId: mockTask.id, agentId: mockBusyAgent.id })
        .expect(400);
    });
  });

  describe('GET /matching/candidates', () => {
    it('should list candidates', async () => {
      mockRepository.findTaskById.mockResolvedValue(mockTask);
      mockRepository.findOrderById.mockResolvedValue(mockOrder);
      mockRepository.listCandidateAgents.mockResolvedValue([mockIdleAgent]);
      mockRepository.getQueueCount.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get(`/matching/candidates?taskId=${mockTask.id}`)
        .set('x-user-id', testUserId)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0].queue).toEqual({
        queuedCount: 1,
        capacity: QUEUE_MAX_N,
        available: QUEUE_MAX_N - 1,
      });
    });

    it('should return 400 if x-user-id header is missing', async () => {
      await request(app.getHttpServer())
        .get(`/matching/candidates?taskId=${mockTask.id}`)
        .expect(400);
    });

    it('should return 400 if taskId is missing', async () => {
      await request(app.getHttpServer())
        .get('/matching/candidates')
        .set('x-user-id', testUserId)
        .expect(400);
    });
  });
});
