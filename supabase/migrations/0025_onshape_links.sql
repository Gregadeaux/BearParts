-- Link library parts to their Onshape source so the panel can recognize
-- already-exported parts and append versions instead of duplicating.

alter table public.library_parts
  add column onshape_document_id text,
  add column onshape_element_id text,
  add column onshape_part_id text;

create index library_parts_onshape_idx
  on public.library_parts (onshape_document_id, onshape_element_id, onshape_part_id)
  where onshape_document_id is not null;
