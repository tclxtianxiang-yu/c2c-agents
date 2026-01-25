import { Injectable } from '@nestjs/common';

interface EmbeddingResponse {
  embedding: number[];
  model: string;
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

interface OpenAIEmbeddingData {
  embedding: number[];
  index: number;
  object: string;
}

interface OpenAIEmbeddingResponse {
  data: OpenAIEmbeddingData[];
  model: string;
  object: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

@Injectable()
export class EmbeddingService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl = 'https://api.openai.com/v1/embeddings';

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY ?? '';
    this.model = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';

    if (!this.apiKey) {
      console.warn('[EmbeddingService] OPENAI_API_KEY not configured, embedding features disabled');
    }
  }

  isEnabled(): boolean {
    return Boolean(this.apiKey);
  }

  getModel(): string {
    return this.model;
  }

  async generateEmbedding(text: string): Promise<EmbeddingResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`
      );
    }

    const data = (await response.json()) as OpenAIEmbeddingResponse;
    const embeddingData = data.data[0];

    return {
      embedding: embeddingData.embedding,
      model: data.model,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        totalTokens: data.usage.total_tokens,
      },
    };
  }

  async generateEmbeddings(texts: string[]): Promise<EmbeddingResponse[]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`
      );
    }

    const data = (await response.json()) as OpenAIEmbeddingResponse;

    return data.data.map((item) => ({
      embedding: item.embedding,
      model: data.model,
      usage: {
        promptTokens: Math.floor(data.usage.prompt_tokens / texts.length),
        totalTokens: Math.floor(data.usage.total_tokens / texts.length),
      },
    }));
  }

  buildAgentEmbeddingText(agent: { name: string; description: string; tags: string[] }): string {
    const parts = [`Name: ${agent.name}`, `Description: ${agent.description}`];

    if (agent.tags.length > 0) {
      parts.push(`Tags: ${agent.tags.join(', ')}`);
    }

    return parts.join('\n');
  }

  buildTaskEmbeddingText(task: {
    title: string;
    description: string;
    type: string;
    tags: string[];
  }): string {
    const parts = [
      `Title: ${task.title}`,
      `Description: ${task.description}`,
      `Type: ${task.type}`,
    ];

    if (task.tags.length > 0) {
      parts.push(`Tags: ${task.tags.join(', ')}`);
    }

    return parts.join('\n');
  }
}
