import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';

describe('AgentRecommendation E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /agents/recommend', () => {
    it('should return 201 with valid request', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/recommend')
        .send({
          title: 'Build a website',
          description: 'Create a landing page for my startup',
          type: 'website',
          tags: ['web', 'frontend'],
          expectedReward: '5000000',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('candidates');
      expect(response.body).toHaveProperty('recommended');
      expect(Array.isArray(response.body.candidates)).toBe(true);
      expect(Array.isArray(response.body.recommended)).toBe(true);
    });

    it('should return empty arrays when no agents match', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents/recommend')
        .send({
          title: 'Very specific task that no agent matches',
          description: 'xyzzy12345 unique description',
          type: 'other_mastra',
          tags: ['nonexistent-tag-12345'],
          expectedReward: '1',
        });

      expect(response.status).toBe(201);
      expect(response.body.candidates).toEqual([]);
      expect(response.body.recommended).toEqual([]);
    });
  });
});
