# Skill: Supabase RLS

## Rule: Every new table MUST have RLS enabled immediately

Never create a table without the following 3-step block:

```sql
-- 1. Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- 2. Default-deny (required even if policies exist)
-- RLS blocks all access by default once enabled — explicit policies must grant access

-- 3. Create policies per role/action
CREATE POLICY "anon can read"
  ON table_name FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "authenticated can insert own rows"
  ON table_name FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "authenticated can update own rows"
  ON table_name FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "authenticated can delete own rows"
  ON table_name FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
```

## Supabase service role bypass

The `service_role` key bypasses RLS entirely — use it only in Vercel serverless functions, never in the browser (`VITE_` env vars).

## Pattern for this project (gavot-app)

Tables: `appointments`, `services`, `settings`, `users`, `reviews`, `gallery`, `waitlist`, `messages`

All admin writes (from `/api/*.js`) use `service_role` → RLS irrelevant there.  
Client reads (from `src/utils/db.js`) use `anon` key → RLS must allow SELECT explicitly.

### Template migration snippet

```sql
CREATE TABLE IF NOT EXISTS my_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow anon read" ON my_table FOR SELECT TO anon USING (true);
CREATE POLICY "allow service full" ON my_table FOR ALL TO service_role USING (true) WITH CHECK (true);
```
