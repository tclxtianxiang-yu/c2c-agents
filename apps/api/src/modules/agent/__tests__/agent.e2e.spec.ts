import { AgentStatus } from '@c2c-agents/shared';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../app.module';

describe('Agent E2E Tests', () => {
  let app: INestApplication;
  let createdAgentId: string;
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

  describe('POST /agents', () => {
    it('should create agent successfully', async () => {
      const createDto = {
        name: 'E2E Test Agent',
        description: 'This is an E2E test agent',
        mastraUrl: 'https://mastra.cloud/agent/e2e-test',
        supportedTaskTypes: ['writing', 'translation'],
        minPrice: '1000000',
        maxPrice: '10000000',
        tags: ['test', 'e2e'],
      };

      const response = await request(app.getHttpServer())
        .post('/agents')
        .set('x-user-id', testUserId)
        .send(createDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(createDto.name);
      expect(response.body.description).toBe(createDto.description);
      expect(response.body.ownerId).toBe(testUserId);
      expect(response.body.status).toBe(AgentStatus.Idle);

      createdAgentId = response.body.id;
    });

    it('should return 400 if x-user-id header is missing', async () => {
      await request(app.getHttpServer())
        .post('/agents')
        .send({
          name: 'Test',
          description: 'Test',
          mastraUrl: 'https://test.com',
          supportedTaskTypes: ['writing'],
          minPrice: '1000000',
          maxPrice: '10000000',
        })
        .expect(400);
    });

    it('should return 400 if minPrice > maxPrice', async () => {
      await request(app.getHttpServer())
        .post('/agents')
        .set('x-user-id', testUserId)
        .send({
          name: 'Test',
          description: 'Test',
          mastraUrl: 'https://test.com',
          supportedTaskTypes: ['writing'],
          minPrice: '10000000',
          maxPrice: '1000000',
        })
        .expect(400);
    });
  });

  describe('GET /agents/:id', () => {
    it('should get agent by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/agents/${createdAgentId}`)
        .expect(200);

      expect(response.body.id).toBe(createdAgentId);
      expect(response.body.name).toBe('E2E Test Agent');
    });

    it('should return 404 if agent not found', async () => {
      await request(app.getHttpServer()).get('/agents/non-existent-id').expect(404);
    });
  });

  describe('PATCH /agents/:id', () => {
    it('should update agent successfully', async () => {
      const updateDto = {
        name: 'Updated E2E Agent',
        description: 'Updated description',
      };

      const response = await request(app.getHttpServer())
        .patch(`/agents/${createdAgentId}`)
        .set('x-user-id', testUserId)
        .send(updateDto)
        .expect(200);

      expect(response.body.name).toBe(updateDto.name);
      expect(response.body.description).toBe(updateDto.description);
    });

    it('should return 403 if user is not agent owner', async () => {
      await request(app.getHttpServer())
        .patch(`/agents/${createdAgentId}`)
        .set('x-user-id', 'another-user')
        .send({ name: 'Hacked' })
        .expect(403);
    });
  });

  describe('GET /agents', () => {
    it('should list agents', async () => {
      const response = await request(app.getHttpServer()).get('/agents').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should filter by keyword', async () => {
      const response = await request(app.getHttpServer()).get('/agents?keyword=E2E').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // 应该包含我们创建的 Agent
      const found = response.body.some((agent: { name: string }) => agent.name.includes('E2E'));
      expect(found).toBe(true);
    });

    it('should filter by tags', async () => {
      const response = await request(app.getHttpServer()).get('/agents?tags=e2e').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter by taskType', async () => {
      const response = await request(app.getHttpServer())
        .get('/agents?taskType=writing')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /agents/mine', () => {
    it('should get my agents', async () => {
      const response = await request(app.getHttpServer())
        .get('/agents/mine')
        .set('x-user-id', testUserId)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].ownerId).toBe(testUserId);
    });

    it('should return 400 if x-user-id header is missing', async () => {
      await request(app.getHttpServer()).get('/agents/mine').expect(400);
    });
  });
});
