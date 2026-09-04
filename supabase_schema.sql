-- ==========================================================
-- BORONGAN TRANSPORT TICKETING AND FEE COLLECTION SYSTEM
-- PostgreSQL Database Schema for Supabase
-- ==========================================================

-- 1. Users Table (Administrators and Drivers)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'driver')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Drivers Table
CREATE TABLE IF NOT EXISTS drivers (
    driver_id VARCHAR(20) PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    full_name VARCHAR(150) NOT NULL,
    address TEXT,
    contact VARCHAR(50),
    birthdate DATE,
    gender VARCHAR(20),
    vehicle_type VARCHAR(50) NOT NULL,
    plate_number VARCHAR(20) UNIQUE NOT NULL,
    license_no VARCHAR(50) UNIQUE NOT NULL,
    photo TEXT,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    license_expiration DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id SERIAL PRIMARY KEY,
    plate_number VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL,
    driver_id VARCHAR(20) REFERENCES drivers(driver_id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Fee Settings Table
CREATE TABLE IF NOT EXISTS fee_settings (
    id SERIAL PRIMARY KEY,
    vehicle_type VARCHAR(50) UNIQUE NOT NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Payments Table (Terminal Fee Collections)
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    receipt_no VARCHAR(50) UNIQUE NOT NULL,
    driver_id VARCHAR(20) REFERENCES drivers(driver_id) ON DELETE CASCADE,
    vehicle_id INTEGER REFERENCES vehicles(vehicle_id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL,
    transaction_date DATE NOT NULL,
    transaction_time TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. QR Codes Table
CREATE TABLE IF NOT EXISTS qr_codes (
    qr_id SERIAL PRIMARY KEY,
    driver_id VARCHAR(20) UNIQUE REFERENCES drivers(driver_id) ON DELETE CASCADE,
    vehicle_id INTEGER REFERENCES vehicles(vehicle_id) ON DELETE SET NULL,
    qr_data TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    times_used INTEGER DEFAULT 0,
    last_scanned TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. Activities Log Table
CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    badge_class VARCHAR(50) DEFAULT 'info',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- INDEXES FOR FAST SEARCH & LOOKUPS
-- ==========================================================
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_drivers_plate ON drivers(plate_number);
CREATE INDEX IF NOT EXISTS idx_drivers_license ON drivers(license_no);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate_number);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(transaction_date);
CREATE INDEX IF NOT EXISTS idx_payments_driver ON payments(driver_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_driver ON qr_codes(driver_id);

-- ==========================================================
-- DEFAULT SEED DATA
-- ==========================================================

-- Default Fee Settings
INSERT INTO fee_settings (vehicle_type, amount)
VALUES
    ('Tricycle', 10.00),
    ('Jeepney', 20.00),
    ('Multicab', 15.00),
    ('Bus', 50.00)
ON CONFLICT (vehicle_type) DO UPDATE SET amount = EXCLUDED.amount;

-- Default Administrator Account
-- Username: admin
-- Password: Admin@123456
-- (Hashed with bcrypt PASSWORD_DEFAULT)
INSERT INTO users (username, password, role)
VALUES ('admin', '$2y$12$mA1Ol6DGkUje5lyvKIreqOB.JEsqm6RoY3LYuCaPZnWtdf1JS99Q2', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Initial activity log entry
INSERT INTO activities (action, details, badge_class)
VALUES ('System Initialized', 'Supabase PostgreSQL database schema configured successfully.', 'added');
