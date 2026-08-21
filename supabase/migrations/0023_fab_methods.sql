-- Manufacturing flows: each part follows a method-specific pipeline.
--   cnc:    queued → toolpaths → saw → ready → in_progress → finishing → done
--   print:  queued → slicing → ready → in_progress → done
--   laser:  queued → in_progress → done
--   manual: queued → in_progress → done
-- Assignment becomes orthogonal to stage ("assigned" folds into queued).

alter table public.parts add column method text not null default 'manual'
  check (method in ('cnc', 'laser', 'manual', 'print'));

update public.parts set method = case file_type
  when 'dxf' then 'laser'
  when 'stl' then 'print'
  when 'step' then 'cnc'
  else 'manual'
end;

update public.parts set status = 'queued' where status = 'assigned';

alter table public.parts drop constraint parts_status_check;
alter table public.parts add constraint parts_status_check check (
  status in ('queued', 'toolpaths', 'slicing', 'saw', 'ready', 'in_progress', 'finishing', 'done', 'rejected')
);
