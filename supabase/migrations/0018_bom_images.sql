-- Product image on BOM items (filled by the Shopify lookup).
alter table public.bom_items add column image_url text;
