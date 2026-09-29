-- X Monitor PayPay / Kyash 30-day entitlement billing.
-- Browser roles are deliberately denied; server-side service_role access only.

create table if not exists public.x_monitor_payment_config (
  id smallint primary key default 1,
  paypay_enabled boolean not null default false,
  kyash_enabled boolean not null default false,
  price_paypay integer not null default 0 check (price_paypay >= 0 and price_paypay <= 1000000),
  price_kyash integer not null default 0 check (price_kyash >= 0 and price_kyash <= 1000000),
  updated_at timestamptz not null default now(),
  constraint x_monitor_payment_config_singleton check (id = 1)
);

insert into public.x_monitor_payment_config (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.x_monitor_payment_accounts (
  id smallint primary key default 1,
  paypay_phone_enc text,
  paypay_password_enc text,
  paypay_uuid text,
  kyash_email_enc text,
  kyash_password_enc text,
  kyash_client_uuid text,
  kyash_installation_uuid text,
  kyash_access_token_enc text,
  updated_at timestamptz not null default now(),
  constraint x_monitor_payment_accounts_singleton check (id = 1)
);

insert into public.x_monitor_payment_accounts (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.x_monitor_payment_login_challenges (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('paypay', 'kyash')),
  payload_enc text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists x_monitor_payment_login_challenges_expires_idx
  on public.x_monitor_payment_login_challenges (expires_at);

create table if not exists public.x_monitor_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  provider text not null check (provider in ('paypay', 'kyash')),
  amount integer not null check (amount >= 0),
  link_hash text not null unique,
  payment_link_enc text,
  status text not null default 'processing'
    check (status in ('processing', 'pending', 'paid', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  entitlement_expires_at timestamptz
);

create index if not exists x_monitor_payments_user_created_idx
  on public.x_monitor_payments (user_id, created_at desc);
create index if not exists x_monitor_payments_status_idx
  on public.x_monitor_payments (status, updated_at);

create table if not exists public.x_monitor_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  expires_at timestamptz not null,
  last_payment_id uuid references public.x_monitor_payments (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists x_monitor_subscriptions_expires_idx
  on public.x_monitor_subscriptions (expires_at);

alter table public.x_monitor_payment_config enable row level security;
alter table public.x_monitor_payment_accounts enable row level security;
alter table public.x_monitor_payment_login_challenges enable row level security;
alter table public.x_monitor_payments enable row level security;
alter table public.x_monitor_subscriptions enable row level security;

revoke all on table public.x_monitor_payment_config from anon, authenticated;
revoke all on table public.x_monitor_payment_accounts from anon, authenticated;
revoke all on table public.x_monitor_payment_login_challenges from anon, authenticated;
revoke all on table public.x_monitor_payments from anon, authenticated;
revoke all on table public.x_monitor_subscriptions from anon, authenticated;

grant select, insert, update, delete on table public.x_monitor_payment_config to service_role;
grant select, insert, update, delete on table public.x_monitor_payment_accounts to service_role;
grant select, insert, update, delete on table public.x_monitor_payment_login_challenges to service_role;
grant select, insert, update, delete on table public.x_monitor_payments to service_role;
grant select, insert, update, delete on table public.x_monitor_subscriptions to service_role;

create or replace function public.x_monitor_finalize_payment(p_payment_id uuid)
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment public.x_monitor_payments%rowtype;
  v_current_expiry timestamptz;
  v_new_expiry timestamptz;
begin
  select *
    into v_payment
    from public.x_monitor_payments
   where id = p_payment_id
   for update;

  if not found then
    raise exception 'x monitor payment not found';
  end if;

  if v_payment.status = 'paid' and v_payment.entitlement_expires_at is not null then
    return v_payment.entitlement_expires_at;
  end if;

  if v_payment.status not in ('processing', 'pending') then
    raise exception 'x monitor payment is not finalizable';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_payment.user_id::text, 0));

  select expires_at
    into v_current_expiry
    from public.x_monitor_subscriptions
   where user_id = v_payment.user_id
   for update;

  v_new_expiry :=
    greatest(coalesce(v_current_expiry, now()), now()) + interval '30 days';

  insert into public.x_monitor_subscriptions (
    user_id, email, expires_at, last_payment_id, updated_at
  )
  values (
    v_payment.user_id, v_payment.email, v_new_expiry, v_payment.id, now()
  )
  on conflict (user_id) do update
    set email = excluded.email,
        expires_at = excluded.expires_at,
        last_payment_id = excluded.last_payment_id,
        updated_at = now();

  update public.x_monitor_payments
     set status = 'paid',
         paid_at = coalesce(paid_at, now()),
         entitlement_expires_at = v_new_expiry,
         updated_at = now()
   where id = v_payment.id;

  return v_new_expiry;
end;
$$;

revoke all on function public.x_monitor_finalize_payment(uuid) from public;
revoke all on function public.x_monitor_finalize_payment(uuid) from anon, authenticated;
grant execute on function public.x_monitor_finalize_payment(uuid) to service_role;
