-- Run after 010_mentions.sql. OSPNM = "O Quanto Nós Passamos Nessa Música" — reviews de rolê,
-- só pra faixas na linha do batidão (funk/eletrofunk), com garrafinhas (nível de bebida) além
-- das estrelinhas de qualidade, e dois textos obrigatórios.

create table if not exists ospnm_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id text not null references tracks(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5), -- quão bom foi se passar
  bottles smallint not null check (bottles between 1 and 5), -- nível de bebida
  justification text not null, -- texto cômico justificando as estrelinhas
  craziness_note text not null, -- descrição obrigatória do nível de loucura
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, track_id)
);

create index if not exists ospnm_entries_track_idx on ospnm_entries (track_id);

alter table ospnm_entries enable row level security;

drop policy if exists "ospnm entries are readable by authenticated users" on ospnm_entries;
create policy "ospnm entries are readable by authenticated users"
  on ospnm_entries for select to authenticated using (true);

drop policy if exists "users manage their own ospnm entries" on ospnm_entries;
create policy "users manage their own ospnm entries"
  on ospnm_entries for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
