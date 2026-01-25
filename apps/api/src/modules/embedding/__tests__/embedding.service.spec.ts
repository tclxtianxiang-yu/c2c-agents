import { Test, type TestingModule } from '@nestjs/testing';
import { EmbeddingService } from '../embedding.service';

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  const originalEnv = process.env;

  beforeEach(async () => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isEnabled', () => {
    it('should return false when OPENAI_API_KEY is not set', async () => {
      delete process.env.OPENAI_API_KEY;

      const module: TestingModule = await Test.createTestingModule({
        providers: [EmbeddingService],
      }).compile();

      service = module.get<EmbeddingService>(EmbeddingService);
      expect(service.isEnabled()).toBe(false);
    });

    it('should return true when OPENAI_API_KEY is set', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';

      const module: TestingModule = await Test.createTestingModule({
        providers: [EmbeddingService],
      }).compile();

      service = module.get<EmbeddingService>(EmbeddingService);
      expect(service.isEnabled()).toBe(true);
    });
  });

  describe('getModel', () => {
    it('should return default model when OPENAI_EMBEDDING_MODEL is not set', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      delete process.env.OPENAI_EMBEDDING_MODEL;

      const module: TestingModule = await Test.createTestingModule({
        providers: [EmbeddingService],
      }).compile();

      service = module.get<EmbeddingService>(EmbeddingService);
      expect(service.getModel()).toBe('text-embedding-3-small');
    });

    it('should return custom model when OPENAI_EMBEDDING_MODEL is set', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.OPENAI_EMBEDDING_MODEL = 'text-embedding-3-large';

      const module: TestingModule = await Test.createTestingModule({
        providers: [EmbeddingService],
      }).compile();

      service = module.get<EmbeddingService>(EmbeddingService);
      expect(service.getModel()).toBe('text-embedding-3-large');
    });
  });

  describe('buildAgentEmbeddingText', () => {
    beforeEach(async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';

      const module: TestingModule = await Test.createTestingModule({
        providers: [EmbeddingService],
      }).compile();

      service = module.get<EmbeddingService>(EmbeddingService);
    });

    it('should build text with name and description', () => {
      const result = service.buildAgentEmbeddingText({
        name: 'Test Agent',
        description: 'A test agent for unit testing',
        tags: [],
      });

      expect(result).toBe('Name: Test Agent\nDescription: A test agent for unit testing');
    });

    it('should include tags when present', () => {
      const result = service.buildAgentEmbeddingText({
        name: 'Test Agent',
        description: 'A test agent',
        tags: ['coding', 'python', 'automation'],
      });

      expect(result).toBe(
        'Name: Test Agent\nDescription: A test agent\nTags: coding, python, automation'
      );
    });
  });

  describe('buildTaskEmbeddingText', () => {
    beforeEach(async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';

      const module: TestingModule = await Test.createTestingModule({
        providers: [EmbeddingService],
      }).compile();

      service = module.get<EmbeddingService>(EmbeddingService);
    });

    it('should build text with title, description, and type', () => {
      const result = service.buildTaskEmbeddingText({
        title: 'Build a website',
        description: 'Create a responsive landing page',
        type: 'website',
        tags: [],
      });

      expect(result).toBe(
        'Title: Build a website\nDescription: Create a responsive landing page\nType: website'
      );
    });

    it('should include tags when present', () => {
      const result = service.buildTaskEmbeddingText({
        title: 'Write Python script',
        description: 'Automate data processing',
        type: 'code',
        tags: ['python', 'automation'],
      });

      expect(result).toBe(
        'Title: Write Python script\nDescription: Automate data processing\nType: code\nTags: python, automation'
      );
    });
  });

  describe('generateEmbedding', () => {
    it('should throw error when API key is not configured', async () => {
      delete process.env.OPENAI_API_KEY;

      const module: TestingModule = await Test.createTestingModule({
        providers: [EmbeddingService],
      }).compile();

      service = module.get<EmbeddingService>(EmbeddingService);

      await expect(service.generateEmbedding('test')).rejects.toThrow(
        'OpenAI API key not configured'
      );
    });
  });
});
