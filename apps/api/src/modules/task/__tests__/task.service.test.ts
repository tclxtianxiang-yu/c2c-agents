import { OrderStatus, TaskStatus, ValidationError } from '@c2c-agents/shared';
import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { ChainService } from '../../core/chain.service';
import type { TaskRepository } from '../task.repository';
import { TaskService } from '../task.service';

function seedEnv() {
  process.env.CHAIN_RPC_URL = 'https://rpc.example';
  process.env.MOCK_USDT_ADDRESS = '0x1111111111111111111111111111111111111111';
  process.env.ESCROW_ADDRESS = '0x2222222222222222222222222222222222222222';
  process.env.PLATFORM_OPERATOR_PRIVATE_KEY = `0x${'1'.repeat(64)}`;
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
}

// Use valid UUIDs for test user IDs
const TEST_USER_ID = '11111111-1111-4111-8111-111111111111';

describe('TaskService', () => {
  beforeAll(seedEnv);

  it('validates create task input', async () => {
    const repository = {
      createTask: jest.fn(),
      findActiveUserIdByAddress: jest.fn(async () => null),
    } as unknown as TaskRepository;
    const chainService = {} as ChainService;
    const service = new TaskService(repository, chainService);

    await expect(
      service.createTask(TEST_USER_ID, {
        title: '',
        description: 'desc',
        type: 'website',
        expectedReward: '1000000',
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('creates task and attachments', async () => {
    const repository = {
      createTask: jest.fn(async () => ({ id: 'task-1', status: TaskStatus.Unpaid })),
      addTaskAttachments: jest.fn(async () => undefined),
      findActiveUserIdByAddress: jest.fn(async () => null),
    } as unknown as TaskRepository;
    const chainService = {} as ChainService;
    const service = new TaskService(repository, chainService);

    const result = await service.createTask(TEST_USER_ID, {
      title: 'New task',
      description: 'desc',
      type: 'website',
      tags: ['ui'],
      attachments: ['file-1'],
      expectedReward: '1000000',
    });

    expect(result).toEqual({ id: 'task-1', status: TaskStatus.Unpaid });
    expect(repository.addTaskAttachments).toHaveBeenCalledWith('task-1', ['file-1']);
  });

  it('confirms payment and publishes task', async () => {
    const repository = {
      findActiveUserIdByAddress: jest.fn(async () => null),
      findTaskById: jest.fn(async () => ({
        id: 'task-1',
        creatorId: TEST_USER_ID,
        title: 'Task',
        description: 'desc',
        type: 'website',
        tags: [],
        expectedReward: '1000000',
        status: TaskStatus.Unpaid,
        currentOrderId: null,
        currentStatus: null,
        lastPayTxHash: null,
        payFailReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      findOrderByPayTxHash: jest.fn(async () => null),
      getActiveWalletAddress: jest.fn(async () => '0xabc'),
      createOrder: jest.fn(async () => ({
        id: 'order-1',
        taskId: 'task-1',
        creatorId: TEST_USER_ID,
        providerId: null,
        agentId: null,
        status: OrderStatus.Standby,
        rewardAmount: '1000000',
        platformFeeRate: '0.15',
        platformFeeAmount: null,
        payTxHash: '0xpay',
        escrowAmount: '1000000',
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      updateTask: jest.fn(async () => ({
        id: 'task-1',
        creatorId: TEST_USER_ID,
        title: 'Task',
        description: 'desc',
        type: 'website',
        tags: [],
        expectedReward: '1000000',
        status: TaskStatus.Published,
        currentOrderId: 'order-1',
        currentStatus: OrderStatus.Standby,
        lastPayTxHash: '0xpay',
        payFailReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      deleteOrder: jest.fn(async () => undefined),
    } as unknown as TaskRepository;

    const chainService = {
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
    } as unknown as ChainService;

    const service = new TaskService(repository, chainService);

    const result = await service.confirmPayment(TEST_USER_ID, 'task-1', '0xpay');
    expect(result).toEqual({
      taskId: 'task-1',
      orderId: 'order-1',
      status: TaskStatus.Published,
      confirmations: 1,
    });
    expect(repository.updateTask).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        status: TaskStatus.Published,
        currentOrderId: 'order-1',
      })
    );
  });
});
