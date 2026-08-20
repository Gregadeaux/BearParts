-- How many to actually order — can differ from the BOM quantity
-- (partial orders, or extras for spares). Null falls back to quantity.
alter table public.bom_items add column order_quantity int check (order_quantity > 0);
