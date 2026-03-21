-- Run this in Supabase SQL Editor
-- This script is idempotent - safe to run multiple times

-- Users table with mobile as primary key
CREATE TABLE IF NOT EXISTS users (
  mobile text primary key,
  password_hash text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Expenses table with user_id (mobile) foreign key
CREATE TABLE IF NOT EXISTS expenses (
  id text primary key,
  user_id text REFERENCES users(mobile) ON DELETE CASCADE,
  expense_date text not null,
  expense_type text not null default 'Daily',
  major text not null,
  sub text not null,
  amount numeric not null,
  description text default '',
  deleted boolean default false,
  updated_at timestamptz default now()
);

-- Incomes table with user_id (mobile) foreign key
CREATE TABLE IF NOT EXISTS incomes (
  id text primary key,
  user_id text REFERENCES users(mobile) ON DELETE CASCADE,
  income_date text not null,
  income_type text not null,
  amount numeric not null,
  description text default '',
  month_key text not null,
  deleted boolean default false,
  updated_at timestamptz default now()
);

-- Budgets table with user_id (mobile) foreign key
CREATE TABLE IF NOT EXISTS budgets (
  id text primary key,
  user_id text REFERENCES users(mobile) ON DELETE CASCADE,
  category text not null,
  amount numeric not null,
  updated_at timestamptz default now(),
  unique(user_id, category)
);

-- Enable RLS but allow anon full access (personal app)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all" ON users;
DROP POLICY IF EXISTS "anon_all" ON expenses;
DROP POLICY IF EXISTS "anon_all" ON incomes;
DROP POLICY IF EXISTS "anon_all" ON budgets;

CREATE POLICY "anon_all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON incomes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON budgets FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for better performance (IF NOT EXISTS for idempotency)
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_incomes_user_id ON incomes(user_id);
CREATE INDEX IF NOT EXISTS idx_incomes_month ON incomes(month_key);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
