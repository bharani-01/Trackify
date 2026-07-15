-- Seed ONLY the System Administrator account for a fresh setup
-- The password hash will be replaced dynamically during database initialization
INSERT INTO users (name, register_number, email, password_hash, role, department, semester)
VALUES 
('System Administrator', 'ADMIN001', 'admin@trackify.com', '__ADMIN_PASSWORD_HASH__', 'admin', 'Management', 1)
ON CONFLICT (email) DO NOTHING;
