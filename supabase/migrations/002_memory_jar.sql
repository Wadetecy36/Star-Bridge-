-- Memory Jar: persistent room-scoped bottles
create table if not exists memory_bottles (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 300),
  created_at timestamptz not null default now()
);

create index if not exists memory_bottles_room_created_idx on memory_bottles(room_id, created_at desc);
alter table memory_bottles enable row level security;
alter publication supabase_realtime add table memory_bottles;
