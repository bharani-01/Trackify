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

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
