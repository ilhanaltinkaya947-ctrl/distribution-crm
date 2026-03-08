-- ═══════════════════════════════════════════
-- EMPLOYEES TABLE + RBAC
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'sales_rep', 'picker', 'driver')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_employees_telegram_id ON employees(telegram_id);

-- Insert a placeholder admin — replace 000000000 with your real Telegram ID
INSERT INTO employees (telegram_id, full_name, role)
VALUES (000000000, 'Admin (замените ID)', 'admin')
ON CONFLICT (telegram_id) DO NOTHING;

-- Quick lookup function for the webhook
CREATE OR REPLACE FUNCTION get_employee_by_tg(p_telegram_id BIGINT)
RETURNS TABLE(id UUID, telegram_id BIGINT, full_name TEXT, role TEXT, is_active BOOLEAN) AS $$
  SELECT id, telegram_id, full_name, role, is_active
  FROM employees
  WHERE employees.telegram_id = p_telegram_id
  LIMIT 1;
$$ LANGUAGE sql STABLE;
