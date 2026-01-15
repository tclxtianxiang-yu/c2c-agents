import { randomUUID } from 'node:crypto';
import { type Delivery, type FileMetadata, OrderStatus } from '@c2c-agents/shared';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DeliveryModule } from '../delivery.module';
import { DeliveryRepository } from '../delivery.repository';

type OrderRecord = {
  id: string;
  task_id: string;
  creator_id: string;
  provider_id: string | null;
  status: OrderStatus;
  delivered_at: string | null;
};

class InMemoryDeliveryRepository {
  private orders = new Map<string, OrderRecord>();
  private deliveries = new Map<string, Delivery>();
  private deliveryAttachments = new Map<string, FileMetadata[]>();

  seedOrder(order: OrderRecord) {
    this.orders.set(order.id, order);
  }

  async findOrderById(orderId: string): Promise<OrderRecord | null> {
    return this.orders.get(orderId) ?? null;
  }

  async findDeliveryByOrderId(orderId: string): Promise<Delivery | null> {
    for (const delivery of this.deliveries.values()) {
      if (delivery.orderId === orderId) return delivery;
    }
    return null;
  }

  async createDelivery(input: {
    orderId: string;
    providerId: string;
    contentText: string | null;
    externalUrl: string | null;
  }): Promise<Delivery> {
    const now = new Date().toISOString();
    const delivery: Delivery = {
      id: randomUUID(),
      orderId: input.orderId,
      providerId: input.providerId,
      contentText: input.contentText,
      externalUrl: input.externalUrl,
      submittedAt: now,
    };
    this.deliveries.set(delivery.id, delivery);
    return delivery;
  }

  async addDeliveryAttachments(deliveryId: string, attachments: string[]): Promise<void> {
    const files = attachments.map((id) => ({
      id,
      uploaderId: 'user-b',
      bucket: 'public',
      objectPath: `files/${id}`,
      mimeType: 'text/plain',
      sizeBytes: '123',
      sha256: null,
      isPublic: true,
      createdAt: new Date().toISOString(),
    }));
    this.deliveryAttachments.set(deliveryId, files);
  }

  async findDeliveryAttachments(deliveryId: string): Promise<FileMetadata[]> {
    return this.deliveryAttachments.get(deliveryId) ?? [];
  }

  async updateOrderDelivered(orderId: string, deliveredAt: string, status: OrderStatus) {
    const order = this.orders.get(orderId);
    if (!order) return;
    order.status = status;
    order.delivered_at = deliveredAt;
    this.orders.set(orderId, order);
  }

  async updateTaskCurrentStatus(): Promise<void> {
    // noop: not needed in this test stub
  }
}

describe('DeliveryModule (e2e)', () => {
  let app: INestApplication;
  let repository: InMemoryDeliveryRepository;

  beforeAll(async () => {
    repository = new InMemoryDeliveryRepository();
    const moduleRef = await Test.createTestingModule({
      imports: [DeliveryModule],
    })
      .overrideProvider(DeliveryRepository)
      .useValue(repository)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('submits delivery and fetches detail', async () => {
    const orderId = randomUUID();
    repository.seedOrder({
      id: orderId,
      task_id: 'task-1',
      creator_id: 'user-a',
      provider_id: 'user-b',
      status: OrderStatus.InProgress,
      delivered_at: null,
    });

    const submitResponse = await request(app.getHttpServer())
      .post(`/orders/${orderId}/deliveries`)
      .set('x-user-id', 'user-b')
      .send({ contentText: 'done', attachments: ['file-1'] })
      .expect(201);

    expect(submitResponse.body.delivery.orderId).toBe(orderId);

    const detailResponse = await request(app.getHttpServer())
      .get(`/orders/${orderId}/delivery`)
      .expect(200);

    expect(detailResponse.body.delivery.orderId).toBe(orderId);
    expect(detailResponse.body.delivery.attachments.length).toBe(1);
  });
});
