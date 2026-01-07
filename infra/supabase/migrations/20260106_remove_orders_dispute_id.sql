-- Remove orders.dispute_id (dispute link is resolved via disputes.order_id)
alter table public.orders drop constraint if exists fk_orders_dispute;
alter table public.orders drop column if exists dispute_id;
