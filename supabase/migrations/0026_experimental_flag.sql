-- Per-user opt-in for experimental features (e.g. the DXF → G-code generator).

alter table public.profiles
  add column experimental_features boolean not null default false;
