import type { Delivery, FileMetadata, OrderStatus } from '@c2c-agents/shared';
import { Inject, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

const DELIVERY_TABLE = 'deliveries';
const DELIVERY_ATTACHMENTS_TABLE = 'delivery_attachments';
const ORDER_TABLE = 'orders';
const TASK_TABLE = 'tasks';
const FILES_TABLE = 'files';

const DELIVERY_SELECT_FIELDS = `
  id,
  order_id,
  provider_id,
  content_text,
  external_url,
  submitted_at
`;

const ORDER_SELECT_FIELDS = `
  id,
  task_id,
  creator_id,
  provider_id,
  status,
  delivered_at
`;

const FILE_SELECT_FIELDS = `
  id,
  uploader_id,
  bucket,
  object_path,
  mime_type,
  size_bytes,
  sha256,
  is_public,
  created_at
`;

type DeliveryRow = {
  id: string;
  order_id: string;
  provider_id: string;
  content_text: string | null;
  external_url: string | null;
  submitted_at: string;
};

type OrderRow = {
  id: string;
  task_id: string;
  creator_id: string;
  provider_id: string | null;
  status: OrderStatus;
  delivered_at: string | null;
};

type DeliveryAttachmentRow = {
  delivery_id: string;
  file_id: string;
  created_at: string;
};

type FileRow = {
  id: string;
  uploader_id: string;
  bucket: string;
  object_path: string;
  mime_type: string | null;
  size_bytes: string | number | null;
  sha256: string | null;
  is_public: boolean;
  created_at: string;
};

function ensureNoError(error: unknown, context: string): void {
  if (!error) return;
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`${context}: ${message}`);
}

function toDelivery(row: DeliveryRow): Delivery {
  return {
    id: row.id,
    orderId: row.order_id,
    providerId: row.provider_id,
    contentText: row.content_text,
    externalUrl: row.external_url,
    submittedAt: row.submitted_at,
  };
}

function toFile(row: FileRow): FileMetadata {
  return {
    id: row.id,
    uploaderId: row.uploader_id,
    bucket: row.bucket,
    objectPath: row.object_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes !== null ? String(row.size_bytes) : null,
    sha256: row.sha256,
    isPublic: row.is_public,
    createdAt: row.created_at,
  };
}

@Injectable()
export class DeliveryRepository {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  async findOrderById(orderId: string): Promise<OrderRow | null> {
    const { data, error } = await this.supabase
      .query<OrderRow>(ORDER_TABLE)
      .select(ORDER_SELECT_FIELDS)
      .eq('id', orderId)
      .maybeSingle();

    ensureNoError(error, 'Failed to fetch order');
    return data ?? null;
  }

  async createDelivery(input: {
    orderId: string;
    providerId: string;
    contentText: string | null;
    externalUrl: string | null;
  }): Promise<Delivery> {
    const { data, error } = await this.supabase
      .query<DeliveryRow>(DELIVERY_TABLE)
      .insert({
        order_id: input.orderId,
        provider_id: input.providerId,
        content_text: input.contentText,
        external_url: input.externalUrl,
      })
      .select(DELIVERY_SELECT_FIELDS)
      .single();

    ensureNoError(error, 'Failed to create delivery');
    if (!data) throw new Error('Failed to create delivery: empty response');

    return toDelivery(data);
  }

  async addDeliveryAttachments(deliveryId: string, attachments: string[]): Promise<void> {
    if (!attachments.length) return;
    const payload = attachments.map((fileId) => ({
      delivery_id: deliveryId,
      file_id: fileId,
    }));
    const { error } = await this.supabase.query(DELIVERY_ATTACHMENTS_TABLE).insert(payload);
    ensureNoError(error, 'Failed to attach files to delivery');
  }

  async findDeliveryByOrderId(orderId: string): Promise<Delivery | null> {
    const { data, error } = await this.supabase
      .query<DeliveryRow>(DELIVERY_TABLE)
      .select(DELIVERY_SELECT_FIELDS)
      .eq('order_id', orderId)
      .maybeSingle();

    ensureNoError(error, 'Failed to fetch delivery');
    if (!data) return null;
    return toDelivery(data);
  }

  async findDeliveryAttachments(deliveryId: string): Promise<FileMetadata[]> {
    const { data: attachmentRows, error } = await this.supabase
      .query<DeliveryAttachmentRow>(DELIVERY_ATTACHMENTS_TABLE)
      .select('file_id')
      .eq('delivery_id', deliveryId);

    ensureNoError(error, 'Failed to fetch delivery attachments');
    if (!attachmentRows?.length) return [];

    const fileIds = attachmentRows.map((row) => row.file_id);
    const { data: files, error: fileError } = await this.supabase
      .query<FileRow>(FILES_TABLE)
      .select(FILE_SELECT_FIELDS)
      .in('id', fileIds);

    ensureNoError(fileError, 'Failed to fetch attachment metadata');
    return (files ?? []).map(toFile);
  }

  async updateOrderDelivered(
    orderId: string,
    deliveredAt: string,
    status: OrderStatus
  ): Promise<void> {
    const { error } = await this.supabase
      .query(ORDER_TABLE)
      .update({ status, delivered_at: deliveredAt })
      .eq('id', orderId);

    ensureNoError(error, 'Failed to update order delivery status');
  }

  async updateTaskCurrentStatus(taskId: string, status: OrderStatus): Promise<void> {
    const { error } = await this.supabase
      .query(TASK_TABLE)
      .update({ current_status: status })
      .eq('id', taskId);
    ensureNoError(error, 'Failed to update task current status');
  }
}
