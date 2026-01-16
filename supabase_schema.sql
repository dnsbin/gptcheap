-- GPTCheap Supabase schema

create table if not exists orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  email text not null,
  sender_email text,
  payment_id text unique not null,
  status text default 'PENDING',
  created_at timestamp default now(),
  paid_at timestamp,
  lock_reason text,
  credentials_id uuid,
  credentials_email text,
  credentials_password text,
  payment_amount numeric,
  payment_source text,
  gmail_message_id text
);

create table if not exists credentials_inventory (
  id uuid default gen_random_uuid() primary key,
  login_email text not null,
  login_password text not null,
  assigned boolean default false,
  assigned_at timestamp
);

create table if not exists admin_actions (
  id uuid default gen_random_uuid() primary key,
  admin_action text not null,
  order_id uuid references orders(id),
  timestamp timestamp default now(),
  notes text
);

create index if not exists idx_orders_payment_id on orders(payment_id);
create index if not exists idx_orders_user_id on orders(user_id);
create index if not exists idx_orders_status on orders(status);

-- RLS: enable and allow server-side access via service role key.
alter table orders enable row level security;
alter table credentials_inventory enable row level security;
alter table admin_actions enable row level security;

create policy "service_role_all_orders" on orders
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "service_role_all_credentials" on credentials_inventory
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "service_role_all_admin_actions" on admin_actions
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
