-- Tabelle di ARGO: da incollare una volta nell'SQL Editor di Supabase (database del portale clienti)
create table if not exists argo_tasks (
  id bigint generated always as identity primary key,
  testo text not null,
  scadenza timestamptz,
  area text default 'personale',
  priorita text default 'normale',
  fatto boolean default false,
  creato timestamptz default now()
);
create table if not exists argo_notes (
  id bigint generated always as identity primary key,
  testo text not null,
  area text default 'generale',
  creato timestamptz default now()
);
create table if not exists argo_messages (
  id bigint generated always as identity primary key,
  role text not null,
  content text not null,
  creato timestamptz default now()
);
-- Accesso solo dal server di ARGO (service role): nessuna policy pubblica
alter table argo_tasks enable row level security;
alter table argo_notes enable row level security;
alter table argo_messages enable row level security;
