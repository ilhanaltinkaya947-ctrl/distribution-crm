-- Migration: 002_business_rules.sql
-- Strict inventory, financial tracking, delivery proof

-- ============================================================
-- 1. Products: Reserved inventory
-- ============================================================
alter table products add column if not exists reserved_quantity integer not null default 0
  check (reserved_quantity >= 0);

-- Ensure we never reserve more than we have
alter table products add constraint stock_covers_reserved
  check (stock_quantity >= reserved_quantity);

-- ============================================================
-- 2. Orders: Financial tracking
-- ============================================================
alter table orders add column if not exists payment_method text
  check (payment_method in ('cash', 'transfer', 'credit'));

alter table orders add column if not exists payment_status text not null default 'unpaid'
  check (payment_status in ('paid', 'unpaid'));

alter table orders add column if not exists debt_due_date timestamptz;

-- Update status enum to include 'ready' and 'arrived'
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('new', 'picking', 'ready', 'delivering', 'arrived', 'completed', 'cancelled'));

-- ============================================================
-- 3. Orders: Telegram message tracking (for editing messages)
-- ============================================================
alter table orders add column if not exists tg_chat_id bigint;
alter table orders add column if not exists tg_message_id bigint;

-- ============================================================
-- 4. Delivery proof
-- ============================================================
create table if not exists delivery_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  tg_file_id text not null,
  uploaded_by_name text,
  uploaded_at timestamptz default now()
);

create index if not exists idx_delivery_proofs_order on delivery_proofs(order_id);

-- RLS
alter table delivery_proofs enable row level security;
create policy "Allow all on delivery_proofs" on delivery_proofs for all using (true) with check (true);

-- ============================================================
-- 5. Client debt tracking view
-- ============================================================
-- ============================================================
-- 6. RPC: Reserve stock when order is placed
-- ============================================================
create or replace function reserve_stock(p_product_id uuid, p_quantity integer)
returns void language plpgsql as $$
begin
  update products
  set reserved_quantity = reserved_quantity + p_quantity
  where id = p_product_id
    and stock_quantity - reserved_quantity >= p_quantity;

  if not found then
    raise exception 'Insufficient stock for product %', p_product_id;
  end if;
end;
$$;

-- ============================================================
-- 7. RPC: Complete order item (deduct stock + reservation)
-- ============================================================
create or replace function complete_order_item(p_product_id uuid, p_quantity integer)
returns void language plpgsql as $$
begin
  update products
  set stock_quantity = stock_quantity - p_quantity,
      reserved_quantity = reserved_quantity - p_quantity
  where id = p_product_id;
end;
$$;

-- ============================================================
-- 8. RPC: Release reservation on cancellation
-- ============================================================
create or replace function release_stock(p_product_id uuid, p_quantity integer)
returns void language plpgsql as $$
begin
  update products
  set reserved_quantity = reserved_quantity - p_quantity
  where id = p_product_id;
end;
$$;

-- ============================================================
-- 9. Client debt tracking view
-- ============================================================
create or replace view client_debts as
select
  c.id as client_id,
  c.name as client_name,
  c.phone,
  count(o.id) as unpaid_orders,
  coalesce(sum(o.total_amount), 0) as total_debt,
  min(o.debt_due_date) as earliest_due
from clients c
join orders o on o.client_id = c.id
where o.payment_status = 'unpaid'
  and o.status != 'cancelled'
group by c.id, c.name, c.phone;
