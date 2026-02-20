-- PostgreSQL schema for Duo TFT analytics
-- Focus: event-sourced model so advanced coaching can be recomputed as formulas evolve.

create table if not exists duo_pair (
  duo_id uuid primary key,
  player_a_puuid text not null,
  player_b_puuid text not null,
  created_at timestamptz not null default now(),
  unique (player_a_puuid, player_b_puuid)
);

create table if not exists duo_match (
  match_id text primary key,
  duo_id uuid not null references duo_pair(duo_id) on delete cascade,
  queue_id int not null,
  game_datetime timestamptz not null,
  game_length_seconds int null,
  set_number int null,
  patch text null,
  region text not null,
  platform text not null,
  player_a_placement int not null,
  player_b_placement int not null,
  same_team boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_duo_match_duo_time on duo_match (duo_id, game_datetime desc);
create index if not exists idx_duo_match_patch on duo_match (patch);

create table if not exists duo_round_snapshot (
  id bigserial primary key,
  match_id text not null references duo_match(match_id) on delete cascade,
  stage_major int not null,           -- e.g. 2,3,4,5
  stage_minor int not null,           -- e.g. 1..7
  round_key text generated always as (stage_major::text || '-' || stage_minor::text) stored,
  player_slot text not null check (player_slot in ('A','B')),
  hp int null,
  gold int null,
  level int null,
  board_power numeric(10,4) null,
  bench_count int null,
  win_streak int null,
  loss_streak int null,
  components_held int null,
  components_slammed int null,
  created_at timestamptz not null default now(),
  unique (match_id, round_key, player_slot)
);

create index if not exists idx_duo_round_snapshot_match_round
  on duo_round_snapshot (match_id, stage_major, stage_minor, player_slot);

create table if not exists duo_event (
  event_id bigserial primary key,
  match_id text not null references duo_match(match_id) on delete cascade,
  stage_major int null,
  stage_minor int null,
  actor_slot text null check (actor_slot in ('A','B')),
  target_slot text null check (target_slot in ('A','B')),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  event_ts timestamptz not null default now()
);

create index if not exists idx_duo_event_match_type on duo_event (match_id, event_type);
create index if not exists idx_duo_event_type_time on duo_event (event_type, event_ts desc);

-- Examples:
-- event_type = 'gift_sent', payload = { "giftType":"item", "giftCode":"bf_sword", "partnerState":"bleeding" }
-- event_type = 'roll_down', payload = { "gold_before":52, "gold_after":18, "reason":"stabilize" }
-- event_type = 'rescue_arrival', payload = { "roundOutcomeBefore":"loss_likely", "roundOutcomeAfter":"won" }
-- event_type = 'augment_pick', payload = { "augment":"...", "fit":"high" }
-- event_type = 'intent_tag', payload = { "plan_3_2":"tempo", "executed":true, "tags":["panic_roll"] }
-- event_type = 'comms_snapshot', payload = { "latency_ms":2400, "interruptions":1 }

create table if not exists duo_weekly_goal (
  goal_id bigserial primary key,
  duo_id uuid not null references duo_pair(duo_id) on delete cascade,
  week_start date not null,
  goal_code text not null,
  target_value numeric(10,4) not null,
  actual_value numeric(10,4) null,
  status text not null default 'active' check (status in ('active','complete','missed')),
  created_at timestamptz not null default now(),
  unique (duo_id, week_start, goal_code)
);

create table if not exists duo_playbook_snapshot (
  snapshot_id bigserial primary key,
  duo_id uuid not null references duo_pair(duo_id) on delete cascade,
  generated_at timestamptz not null default now(),
  playbook jsonb not null
);

create index if not exists idx_duo_playbook_snapshot_duo_time
  on duo_playbook_snapshot (duo_id, generated_at desc);

create table if not exists duo_metric_daily (
  id bigserial primary key,
  duo_id uuid not null references duo_pair(duo_id) on delete cascade,
  metric_date date not null,
  metric_code text not null,
  metric_value numeric(10,4) not null,
  metadata jsonb not null default '{}'::jsonb,
  unique (duo_id, metric_date, metric_code)
);
