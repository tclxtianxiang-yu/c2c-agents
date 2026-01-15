import { randomUUID } from 'node:crypto';
import { type Order, type OrderStatus, type Task, TaskStatus } from '@c2c-agents/shared';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ChainService } from '../../core/chain.service';
import { CoreModule } from '../../core/core.module';
import { TaskModule } from '../task.module';
import { TaskRepository } from '../task.repository';

type TaskRecord = Task;

class InMemoryTaskRepository {
  private tasks = new Map<string, TaskRecord>();
  private orders = new Map<string, Order>();
  private walletBindings = new Map<string, string>();
  private taskAttachments = new Map<string, string[]>();

  seedWallet(userId: string, role: 'A' | 'B', address: string) {
    this.walletBindings.set(`${userId}:${role}`, address);
  }

  async createTask(input: {
    creatorId: string;
    title: string;
    description: string;
    type: TaskRecord['type'];
    tags: string[];
    expectedReward: string;
  }): Promise<TaskRecord> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const task: TaskRecord = {
      id,
      creatorId: input.creatorId,
      title: input.title,
      description: input.description,
      type: input.type,
      tags: input.tags,
      expectedReward: input.expectedReward,
      status: TaskStatus.Unpaid,
      currentOrderId: null,
      currentStatus: null,
      lastPayTxHash: null,
      payFailReason: null,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(id, task);
    return task;
  }

  async addTaskAttachments(taskId: string, attachments: string[]): Promise<void> {
    const existing = this.taskAttachments.get(taskId) ?? [];
    this.taskAttachments.set(taskId, [...existing, ...attachments]);
  }

  async findTaskById(taskId: string): Promise<TaskRecord | null> {
    return this.tasks.get(taskId) ?? null;
  }

  async updateTask(
    taskId: string,
    input: {
      status?: TaskStatus;
      currentOrderId?: string | null;
      currentStatus?: OrderStatus | null;
      lastPayTxHash?: string | null;
      payFailReason?: string | null;
    }
  ): Promise<TaskRecord> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found');
    const next: TaskRecord = {
      ...task,
      status: input.status ?? task.status,
      currentOrderId: input.currentOrderId ?? task.currentOrderId,
      currentStatus: input.currentStatus ?? task.currentStatus,
      lastPayTxHash: input.lastPayTxHash ?? task.lastPayTxHash,
      payFailReason: input.payFailReason ?? task.payFailReason,
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(taskId, next);
    return next;
  }

  async listTasks(filters: {
    creatorId?: string;
    status?: TaskStatus;
    currentStatus?: OrderStatus;
  }): Promise<TaskRecord[]> {
    return Array.from(this.tasks.values()).filter((task) => {
      if (filters.creatorId && task.creatorId !== filters.creatorId) return false;
      if (filters.status && task.status !== filters.status) return false;
      if (filters.currentStatus && task.currentStatus !== filters.currentStatus) return false;
      return true;
    });
  }

  async findOrderByPayTxHash(payTxHash: string): Promise<Order | null> {
    for (const order of this.orders.values()) {
      if (order.payTxHash === payTxHash) return order;
    }
    return null;
  }

  async createOrder(input: {
    taskId: string;
    creatorId: string;
    status: OrderStatus;
    rewardAmount: string;
    platformFeeRate: string;
    payTxHash: string;
    escrowAmount: string;
  }): Promise<Order> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const order: Order = {
      id,
      taskId: input.taskId,
      creatorId: input.creatorId,
      providerId: null,
      agentId: null,
      status: input.status,
      rewardAmount: input.rewardAmount,
      platformFeeRate: input.platformFeeRate,
      platformFeeAmount: null,
      payTxHash: input.payTxHash,
      escrowAmount: input.escrowAmount,
      payoutTxHash: null,
      refundTxHash: null,
      deliveredAt: null,
      acceptedAt: null,
      autoAcceptedAt: null,
      refundedAt: null,
      paidAt: null,
      completedAt: null,
      refundRequestReason: null,
      cancelRequestReason: null,
      pairingCreatedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.orders.set(id, order);
    return order;
  }

  async deleteOrder(orderId: string): Promise<void> {
    this.orders.delete(orderId);
  }

  async getActiveWalletAddress(userId: string, role: 'A' | 'B'): Promise<string | null> {
    return this.walletBindings.get(`${userId}:${role}`) ?? null;
  }
}

function seedEnv() {
  process.env.CHAIN_RPC_URL = 'https://rpc.example';
  process.env.MOCK_USDT_ADDRESS = '0x1111111111111111111111111111111111111111';
  process.env.ESCROW_ADDRESS = '0x2222222222222222222222222222222222222222';
  process.env.PLATFORM_OPERATOR_PRIVATE_KEY = `0x${'1'.repeat(64)}`;
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
}

describe('TaskModule (e2e)', () => {
  let app: INestApplication;
  let repository: InMemoryTaskRepository;

  beforeAll(async () => {
    seedEnv();
    repository = new InMemoryTaskRepository();
    repository.seedWallet('user-1', 'A', '0xabc');

    const moduleRef = await Test.createTestingModule({
      imports: [CoreModule, TaskModule],
    })
      .overrideProvider(TaskRepository)
      .useValue(repository)
      .overrideProvider(ChainService)
      .useValue({
        verifyPayment: jest.fn(async () => ({
          success: true,
          txHash: '0xpay',
          confirmations: 1,
          actualAmount: '1000000',
        })),
        recordEscrow: jest.fn(async () => ({
          success: true,
          orderKey: '0xorder',
          txHash: '0xescrow',
          confirmations: 1,
          amount: '1000000',
        })),
      } as unknown as ChainService)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates task and confirms payment', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/tasks')
      .set('x-user-id', 'user-1')
      .send({
        title: 'Build landing',
        description: 'Need a page',
        type: 'website',
        tags: ['ui'],
        expectedReward: '1000000',
      })
      .expect(201);

    const taskId = createResponse.body.id as string;
    expect(createResponse.body.status).toBe(TaskStatus.Unpaid);

    const confirmResponse = await request(app.getHttpServer())
      .post(`/tasks/${taskId}/payments/confirm`)
      .set('x-user-id', 'user-1')
      .send({ payTxHash: '0xpay' })
      .expect(201);

    expect(confirmResponse.body.taskId).toBe(taskId);
    expect(confirmResponse.body.status).toBe(TaskStatus.Published);

    const marketResponse = await request(app.getHttpServer())
      .get('/tasks?scope=market')
      .expect(200);

    expect(marketResponse.body.length).toBe(1);
    expect(marketResponse.body[0].id).toBe(taskId);
  });
});
