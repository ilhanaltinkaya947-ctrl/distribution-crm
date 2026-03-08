-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 004: Enterprise WMS + TMS + Audit System
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════
-- 1. EXTENDED ROLES ON EMPLOYEES TABLE
-- ═══════════════════════════════════════════
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE employees ADD CONSTRAINT employees_role_check
  CHECK (role IN ('director', 'admin', 'sales_rep', 'warehouse', 'picker', 'driver', 'accountant'));

-- Migrate existing admin → director (highest role)
UPDATE employees SET role = 'director' WHERE role = 'admin';

-- ═══════════════════════════════════════════
-- 2. PRODUCTS: WMS + TMS COLUMNS
-- ═══════════════════════════════════════════
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(10,3) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS volume_m3 NUMERIC(10,6) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_level INTEGER DEFAULT 0;

-- ═══════════════════════════════════════════
-- 3. ORDERS: ASSIGN SALES REP + ROUTE
-- ═══════════════════════════════════════════
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES employees(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS route_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS picked_by UUID REFERENCES employees(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_by UUID REFERENCES employees(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;

-- ═══════════════════════════════════════════
-- 4. WMS: WAREHOUSE LOCATIONS
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS warehouse_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  zone TEXT NOT NULL,           -- FROZEN-A, FROZEN-B, DRY, COOLED
  aisle TEXT NOT NULL,          -- A1, A2, B1
  rack TEXT NOT NULL,           -- R01, R02
  bin TEXT NOT NULL,            -- 01, 02, 03
  label TEXT GENERATED ALWAYS AS (zone || '-' || aisle || '-' || rack || '-' || bin) STORED,
  max_weight_kg NUMERIC(10,2) DEFAULT 500,
  max_volume_m3 NUMERIC(10,4) DEFAULT 2,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(zone, aisle, rack, bin)
);

ALTER TABLE warehouse_locations DISABLE ROW LEVEL SECURITY;

-- Link products to locations
ALTER TABLE products ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES warehouse_locations(id);

-- ═══════════════════════════════════════════
-- 5. WMS: INVENTORY LEDGER (every movement)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS inventory_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'inbound',       -- goods received
    'outbound',      -- goods shipped (order completed)
    'reserved',      -- stock reserved for order
    'unreserved',    -- reservation cancelled
    'adjustment',    -- manual stock correction
    'transfer',      -- moved between locations
    'return',        -- customer return
    'damaged'        -- write-off
  )),
  quantity INTEGER NOT NULL,          -- positive = in, negative = out
  reference_id UUID,                  -- order_id or other reference
  reference_type TEXT,                -- 'order', 'adjustment', 'transfer'
  location_id UUID REFERENCES warehouse_locations(id),
  performed_by UUID REFERENCES employees(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ledger_product ON inventory_ledger(product_id);
CREATE INDEX idx_ledger_type ON inventory_ledger(movement_type);
CREATE INDEX idx_ledger_ref ON inventory_ledger(reference_id);
CREATE INDEX idx_ledger_date ON inventory_ledger(created_at DESC);

ALTER TABLE inventory_ledger DISABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════
-- 6. TMS: TRUCKS
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS trucks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  license_plate TEXT UNIQUE NOT NULL,
  model TEXT,
  driver_id UUID REFERENCES employees(id),
  max_weight_kg NUMERIC(10,2) NOT NULL DEFAULT 3000,
  max_volume_m3 NUMERIC(10,4) NOT NULL DEFAULT 12,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE trucks DISABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════
-- 7. TMS: ROUTES (delivery runs)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS routes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  truck_id UUID REFERENCES trucks(id),
  driver_id UUID REFERENCES employees(id),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned', 'loading', 'in_transit', 'completed', 'cancelled'
  )),
  planned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  departure_time TIMESTAMPTZ,
  completion_time TIMESTAMPTZ,
  total_weight_kg NUMERIC(10,2) DEFAULT 0,
  total_volume_m3 NUMERIC(10,6) DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_routes_date ON routes(planned_date DESC);
CREATE INDEX idx_routes_driver ON routes(driver_id);
CREATE INDEX idx_routes_status ON routes(status);

ALTER TABLE routes DISABLE ROW LEVEL SECURITY;

-- Now add FK from orders to routes
ALTER TABLE orders ADD CONSTRAINT fk_orders_route
  FOREIGN KEY (route_id) REFERENCES routes(id);

-- ═══════════════════════════════════════════
-- 8. TMS: ROUTE STOPS (order sequence)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS route_stops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id),
  stop_sequence INTEGER NOT NULL,
  estimated_arrival TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'arrived', 'delivered', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(route_id, order_id)
);

CREATE INDEX idx_route_stops_route ON route_stops(route_id);

ALTER TABLE route_stops DISABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════
-- 9. AUDIT LOG
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  table_name TEXT NOT NULL,
  record_id TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_table ON audit_logs(table_name);
CREATE INDEX idx_audit_date ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_employee ON audit_logs(employee_id);
CREATE INDEX idx_audit_record ON audit_logs(record_id);

ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════
-- 10. AUDIT TRIGGERS
-- ═══════════════════════════════════════════

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (action, table_name, record_id, new_data)
    VALUES ('INSERT', TG_TABLE_NAME, NEW.id::TEXT, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (action, table_name, record_id, old_data, new_data)
    VALUES ('UPDATE', TG_TABLE_NAME, NEW.id::TEXT, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (action, table_name, record_id, old_data)
    VALUES ('DELETE', TG_TABLE_NAME, OLD.id::TEXT, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach to orders
DROP TRIGGER IF EXISTS trg_audit_orders ON orders;
CREATE TRIGGER trg_audit_orders
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Attach to products
DROP TRIGGER IF EXISTS trg_audit_products ON products;
CREATE TRIGGER trg_audit_products
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Attach to employees
DROP TRIGGER IF EXISTS trg_audit_employees ON employees;
CREATE TRIGGER trg_audit_employees
  AFTER INSERT OR UPDATE OR DELETE ON employees
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Attach to inventory_ledger
DROP TRIGGER IF EXISTS trg_audit_inventory ON inventory_ledger;
CREATE TRIGGER trg_audit_inventory
  AFTER INSERT OR UPDATE OR DELETE ON inventory_ledger
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- ═══════════════════════════════════════════
-- 11. UPDATED RPCs (with ledger entries)
-- ═══════════════════════════════════════════

-- Reserve stock + write ledger
CREATE OR REPLACE FUNCTION reserve_stock(p_product_id UUID, p_quantity INTEGER, p_order_id UUID DEFAULT NULL, p_employee_id UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE products
  SET reserved_quantity = reserved_quantity + p_quantity
  WHERE id = p_product_id
    AND stock_quantity - reserved_quantity >= p_quantity;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient stock for product %', p_product_id;
  END IF;

  INSERT INTO inventory_ledger (product_id, movement_type, quantity, reference_id, reference_type, performed_by)
  VALUES (p_product_id, 'reserved', p_quantity, p_order_id, 'order', p_employee_id);
END;
$$;

-- Complete order item + write ledger
CREATE OR REPLACE FUNCTION complete_order_item(p_product_id UUID, p_quantity INTEGER, p_order_id UUID DEFAULT NULL, p_employee_id UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity - p_quantity,
      reserved_quantity = reserved_quantity - p_quantity
  WHERE id = p_product_id;

  INSERT INTO inventory_ledger (product_id, movement_type, quantity, reference_id, reference_type, performed_by)
  VALUES (p_product_id, 'outbound', -p_quantity, p_order_id, 'order', p_employee_id);
END;
$$;

-- Release reservation + write ledger
CREATE OR REPLACE FUNCTION release_stock(p_product_id UUID, p_quantity INTEGER, p_order_id UUID DEFAULT NULL, p_employee_id UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE products
  SET reserved_quantity = reserved_quantity - p_quantity
  WHERE id = p_product_id;

  INSERT INTO inventory_ledger (product_id, movement_type, quantity, reference_id, reference_type, performed_by)
  VALUES (p_product_id, 'unreserved', p_quantity, p_order_id, 'order', p_employee_id);
END;
$$;

-- Receive goods (inbound)
CREATE OR REPLACE FUNCTION receive_goods(p_product_id UUID, p_quantity INTEGER, p_location_id UUID DEFAULT NULL, p_employee_id UUID DEFAULT NULL, p_notes TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity + p_quantity
  WHERE id = p_product_id;

  INSERT INTO inventory_ledger (product_id, movement_type, quantity, location_id, performed_by, notes)
  VALUES (p_product_id, 'inbound', p_quantity, p_location_id, p_employee_id, p_notes);
END;
$$;

-- Adjust stock (manual correction)
CREATE OR REPLACE FUNCTION adjust_stock(p_product_id UUID, p_new_quantity INTEGER, p_employee_id UUID DEFAULT NULL, p_notes TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_old_qty INTEGER;
  v_diff INTEGER;
BEGIN
  SELECT stock_quantity INTO v_old_qty FROM products WHERE id = p_product_id FOR UPDATE;
  v_diff := p_new_quantity - v_old_qty;

  UPDATE products SET stock_quantity = p_new_quantity WHERE id = p_product_id;

  INSERT INTO inventory_ledger (product_id, movement_type, quantity, performed_by, notes)
  VALUES (p_product_id, 'adjustment', v_diff, p_employee_id, COALESCE(p_notes, 'Manual adjustment: ' || v_old_qty || ' → ' || p_new_quantity));
END;
$$;

-- ═══════════════════════════════════════════
-- 12. ROUTE CALCULATION FUNCTION
-- ═══════════════════════════════════════════
CREATE OR REPLACE FUNCTION calculate_route_totals(p_route_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_weight NUMERIC;
  v_volume NUMERIC;
  v_count INTEGER;
BEGIN
  SELECT
    COALESCE(SUM(oi.quantity * pr.weight_kg), 0),
    COALESCE(SUM(oi.quantity * pr.volume_m3), 0),
    COUNT(DISTINCT rs.order_id)
  INTO v_weight, v_volume, v_count
  FROM route_stops rs
  JOIN order_items oi ON oi.order_id = rs.order_id
  JOIN products pr ON pr.id = oi.product_id
  WHERE rs.route_id = p_route_id;

  UPDATE routes
  SET total_weight_kg = v_weight,
      total_volume_m3 = v_volume,
      total_orders = v_count
  WHERE id = p_route_id;
END;
$$;

-- ═══════════════════════════════════════════
-- 13. LOW STOCK ALERT VIEW
-- ═══════════════════════════════════════════
CREATE OR REPLACE VIEW low_stock_alerts AS
SELECT
  p.id,
  p.sku,
  p.name,
  p.stock_quantity,
  p.reserved_quantity,
  (p.stock_quantity - p.reserved_quantity) AS available,
  p.min_stock_level,
  wl.label AS location
FROM products p
LEFT JOIN warehouse_locations wl ON wl.id = p.location_id
WHERE (p.stock_quantity - p.reserved_quantity) <= p.min_stock_level
ORDER BY (p.stock_quantity - p.reserved_quantity) ASC;

-- ═══════════════════════════════════════════
-- 14. SEED: WAREHOUSE ZONES
-- ═══════════════════════════════════════════
INSERT INTO warehouse_locations (zone, aisle, rack, bin) VALUES
  ('FROZEN-A', 'A1', 'R01', '01'),
  ('FROZEN-A', 'A1', 'R01', '02'),
  ('FROZEN-A', 'A1', 'R02', '01'),
  ('FROZEN-A', 'A1', 'R02', '02'),
  ('FROZEN-A', 'A2', 'R01', '01'),
  ('FROZEN-A', 'A2', 'R01', '02'),
  ('FROZEN-B', 'B1', 'R01', '01'),
  ('FROZEN-B', 'B1', 'R01', '02'),
  ('FROZEN-B', 'B1', 'R02', '01'),
  ('FROZEN-B', 'B1', 'R02', '02'),
  ('DRY',      'C1', 'R01', '01'),
  ('DRY',      'C1', 'R01', '02'),
  ('COOLED',   'D1', 'R01', '01'),
  ('COOLED',   'D1', 'R01', '02')
ON CONFLICT (zone, aisle, rack, bin) DO NOTHING;
