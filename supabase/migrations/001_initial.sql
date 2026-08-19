-- Constellation persistent room schema
create extension if not exists pgcrypto;

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique not null,
  max_users int not null default 2 check (max_users = 2),
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  username text not null check (char_length(username) between 1 and 30),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  is_online boolean not null default false,
  unique(room_id, username)
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ip_hash text,
  user_agent text
);

create table if not exists constellation_rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  grid_size int not null default 5 check (grid_size between 5 and 8),
  target_count int not null check (target_count > 0),
  time_limit_seconds int,
  difficulty text not null default 'normal',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'active' check (status in ('active','completed','reset'))
);

create unique index if not exists one_active_round_per_room on constellation_rounds(room_id) where status = 'active';

create table if not exists constellation_stars (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references constellation_rounds(id) on delete cascade,
  position int not null,
  is_target boolean not null default false,
  locked_at timestamptz,
  clicked_by_user_1 uuid references users(id) on delete set null,
  clicked_by_user_2 uuid references users(id) on delete set null,
  unique(round_id, position)
);

create table if not exists garden_plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  seed_emoji text not null,
  x float not null check (x between 0 and 100),
  y float not null check (y between 0 and 100),
  planted_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  sent_at timestamptz not null default now()
);

create table if not exists emotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  emote text not null check (char_length(emote) <= 12),
  sent_at timestamptz not null default now()
);

create table if not exists user_settings (
  user_id uuid primary key references users(id) on delete cascade,
  sound_enabled boolean not null default true,
  emote_sound_enabled boolean not null default true,
  notifications_enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text,
  theme text not null default 'night' check (theme in ('day','night')),
  difficulty text not null default 'normal',
  reduce_motion boolean not null default false,
  custom_grid_size int,
  custom_target_count int,
  custom_timer_seconds int
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  event_type text not null,
  metadata jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);

create table if not exists join_rate_limits (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null,
  ip_hash text not null,
  failed_attempts int not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  unique(invite_code, ip_hash)
);

create index if not exists users_room_idx on users(room_id);
create index if not exists plants_user_idx on garden_plants(user_id, planted_at desc);
create index if not exists messages_user_idx on messages(user_id, sent_at desc);
create index if not exists emotes_user_idx on emotes(user_id, sent_at desc);
create index if not exists audit_log_user_idx on audit_log(user_id, created_at desc);

alter table rooms enable row level security;
alter table users enable row level security;
alter table sessions enable row level security;
alter table constellation_rounds enable row level security;
alter table constellation_stars enable row level security;
alter table garden_plants enable row level security;
alter table messages enable row level security;
alter table emotes enable row level security;
alter table user_settings enable row level security;
alter table audit_log enable row level security;
alter table join_rate_limits enable row level security;

-- Browser access uses the service-mediated API only. Keep direct anon reads/writes closed.

alter publication supabase_realtime add table constellation_stars, garden_plants, messages, emotes, users;
