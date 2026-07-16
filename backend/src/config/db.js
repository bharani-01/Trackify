const { Pool } = require('pg');
require('dotenv').config();

// Fallback logic for connection configurations
const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const pool = new Pool({
  connectionString,
  // Add SSL settings if connecting to Supabase (in production or with DB_SSL enabled)
  ssl: process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => {
  console.log('Database connection pool established successfully');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err.message);
});

// Self-healing table migrations: Ensure backups table exists without dropping any data
const initMigrations = async () => {
  const queryText = `
    CREATE TABLE IF NOT EXISTS backups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        filename VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(queryText);
    console.log('Database self-healing table checks completed.');
  } catch (error) {
    console.error('Error during database self-healing migration:', error.message);
  }
};
initMigrations();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
