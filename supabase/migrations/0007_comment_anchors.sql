-- Comments can be pinned to a point on a specific version's geometry:
-- { x, y (inches), versionId, label } — rendered as numbered pins in the viewer.

alter table public.part_comments add column anchor jsonb;
