import { QUEUE_MAX_N } from '@c2c-agents/config/constants';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../app.module';

describe('Queue E2E Tests', () => {
  let app: INestApplication;
  const testAgentId = `test-agent-${Date.now()}`;
  const testUserId = `test-user-${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /queue/agents/:agentId/status', () => {
    it('should return queue status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/queue/agents/${testAgentId}/status`)
        .expect(200);

      expect(response.body).toHaveProperty('agentId', testAgentId);
      expect(response.body).toHaveProperty('queuedCount');
      expect(response.body).toHaveProperty('capacity', QUEUE_MAX_N);
      expect(response.body).toHaveProperty('available');
      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
    });
  });

  describe('GET /queue/orders/:orderId/position', () => {
    it('should return queue position', async () => {
      const response = await request(app.getHttpServer())
        .get(`/queue/orders/order-test/position`)
        .set('x-agent-id', testAgentId)
        .expect(200);

      expect(response.body).toHaveProperty('orderId', 'order-test');
      expect(response.body).toHaveProperty('agentId', testAgentId);
      expect(response.body).toHaveProperty('position');
      expect(response.body).toHaveProperty('inQueue');
    });

    it('should return 400 if x-agent-id header is missing', async () => {
      await request(app.getHttpServer()).get('/queue/orders/order-test/position').expect(400);
    });

    it('should return null position if not in queue', async () => {
      const response = await request(app.getHttpServer())
        .get('/queue/orders/non-existent-order/position')
        .set('x-agent-id', testAgentId)
        .expect(200);

      expect(response.body.position).toBeNull();
      expect(response.body.inQueue).toBe(false);
    });
  });

  describe('DELETE /queue/agents/:agentId/orders/:orderId', () => {
    it('should cancel queue item', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/queue/agents/${testAgentId}/orders/order-test`)
        .set('x-user-id', testUserId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 if x-user-id header is missing', async () => {
      await request(app.getHttpServer())
        .delete(`/queue/agents/${testAgentId}/orders/order-test`)
        .expect(400);
    });

    it('should be idempotent (cancel non-existent item succeeds)', async () => {
      await request(app.getHttpServer())
        .delete(`/queue/agents/${testAgentId}/orders/non-existent`)
        .set('x-user-id', testUserId)
        .expect(200);
    });
  });

  describe('Complete Queue Flow', () => {
    it('should handle full queue lifecycle', async () => {
      // Note: 这个测试需要能够直接调用 QueueService.enqueue
      // 由于 enqueue 不暴露 HTTP API，这里只能测试查询和取消
      // 完整的入队+消费测试需要在单元测试中完成

      // 1. 查询初始状态
      const statusBefore = await request(app.getHttpServer())
        .get(`/queue/agents/${testAgentId}/status`)
        .expect(200);

      expect(statusBefore.body.queuedCount).toBeGreaterThanOrEqual(0);

      // 2. 取消一个不存在的项（幂等测试）
      await request(app.getHttpServer())
        .delete(`/queue/agents/${testAgentId}/orders/test-order`)
        .set('x-user-id', testUserId)
        .expect(200);

      // 3. 再次查询状态
      const statusAfter = await request(app.getHttpServer())
        .get(`/queue/agents/${testAgentId}/status`)
        .expect(200);

      expect(statusAfter.body).toHaveProperty('queuedCount');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent status queries', async () => {
      const promises = Array.from({ length: 10 }, () =>
        request(app.getHttpServer()).get(`/queue/agents/${testAgentId}/status`)
      );

      const results = await Promise.all(promises);

      results.forEach((result) => {
        expect(result.status).toBe(200);
        expect(result.body).toHaveProperty('queuedCount');
      });
    });

    it('should handle concurrent cancel operations', async () => {
      const orderId = `concurrent-order-${Date.now()}`;

      const promises = Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .delete(`/queue/agents/${testAgentId}/orders/${orderId}`)
          .set('x-user-id', testUserId)
      );

      const results = await Promise.all(promises);

      // 所有请求都应该成功（幂等）
      results.forEach((result) => {
        expect(result.status).toBe(200);
      });
    });
  });
});
