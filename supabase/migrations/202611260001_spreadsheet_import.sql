alter table public.products add column if not exists spreadsheet_data jsonb;
alter table public.products add column if not exists spreadsheet_imported_at timestamptz;
