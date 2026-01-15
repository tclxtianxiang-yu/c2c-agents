import { AUTO_ACCEPT_HOURS } from '@c2c-agents/config/constants';
import {
  type DeliveryWithAttachments,
  ErrorCode,
  OrderStatus,
  ValidationError,
} from '@c2c-agents/shared';
import { assertTransition } from '@c2c-agents/shared/state-machine';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { DeliveryRepository } from './delivery.repository';
import type { CreateDeliveryDto } from './dtos/create-delivery.dto';

function isNonEmptyText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function addHours(value: string, hours: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('Invalid deliveredAt timestamp');
  }
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

@Injectable()
export class DeliveryService {
  constructor(@Inject(DeliveryRepository) private readonly repository: DeliveryRepository) {}

  async createDelivery(userId: string, orderId: string, dto: CreateDeliveryDto) {
    const contentText = dto.contentText?.trim() ?? '';
    const externalUrl = dto.externalUrl?.trim() ?? '';
    const attachments = (dto.attachments ?? []).map((fileId) => fileId.trim()).filter(Boolean);

    if (!isNonEmptyText(contentText) && !isNonEmptyText(externalUrl) && !attachments.length) {
      throw new ValidationError('Delivery content is required');
    }

    const order = await this.repository.findOrderById(orderId);
    if (!order) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Order not found' },
        404
      );
    }

    if (order.provider_id !== userId) {
      throw new HttpException(
        { code: ErrorCode.AUTH_FORBIDDEN, message: 'Order does not belong to current user' },
        403
      );
    }

    const existing = await this.repository.findDeliveryByOrderId(orderId);
    if (existing) {
      const attachmentsList = await this.repository.findDeliveryAttachments(existing.id);
      return {
        delivery: { ...existing, attachments: attachmentsList } satisfies DeliveryWithAttachments,
        deliveredAt: order.delivered_at,
        autoAcceptDeadline: order.delivered_at
          ? addHours(order.delivered_at, AUTO_ACCEPT_HOURS)
          : null,
      };
    }

    if (order.status !== OrderStatus.InProgress && order.status !== OrderStatus.Delivered) {
      throw new ValidationError('Order is not in progress');
    }

    if (order.status === OrderStatus.InProgress) {
      assertTransition(order.status, OrderStatus.Delivered);
    }

    const delivery = await this.repository.createDelivery({
      orderId,
      providerId: userId,
      contentText: contentText || null,
      externalUrl: externalUrl || null,
    });

    if (attachments.length) {
      await this.repository.addDeliveryAttachments(delivery.id, attachments);
    }

    const deliveredAt = order.delivered_at ?? new Date().toISOString();
    if (order.status !== OrderStatus.Delivered || !order.delivered_at) {
      await this.repository.updateOrderDelivered(orderId, deliveredAt, OrderStatus.Delivered);
      await this.repository.updateTaskCurrentStatus(order.task_id, OrderStatus.Delivered);
    }

    const attachmentsList = await this.repository.findDeliveryAttachments(delivery.id);

    return {
      delivery: { ...delivery, attachments: attachmentsList } satisfies DeliveryWithAttachments,
      deliveredAt,
      autoAcceptDeadline: addHours(deliveredAt, AUTO_ACCEPT_HOURS),
    };
  }

  async getDelivery(orderId: string) {
    const order = await this.repository.findOrderById(orderId);
    if (!order) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Order not found' },
        404
      );
    }

    const delivery = await this.repository.findDeliveryByOrderId(orderId);
    if (!delivery) {
      throw new HttpException(
        { code: ErrorCode.BUSINESS_RESOURCE_NOT_FOUND, message: 'Delivery not found' },
        404
      );
    }

    const attachments = await this.repository.findDeliveryAttachments(delivery.id);
    return {
      delivery: { ...delivery, attachments } satisfies DeliveryWithAttachments,
      deliveredAt: order.delivered_at,
      autoAcceptDeadline: order.delivered_at
        ? addHours(order.delivered_at, AUTO_ACCEPT_HOURS)
        : null,
    };
  }
}
