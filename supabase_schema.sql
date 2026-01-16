
-- Run this inside Supabase SQL editor

create table orders (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  sender_email text,
  payment_id text unique not null,
  status text default 'PENDING',
  created_at timestamp default now()
);
