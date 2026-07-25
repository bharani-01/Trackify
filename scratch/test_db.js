const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const pool = new Pool({
  connectionString,
  ssl: false
});

async function test() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'timetable_adjustments';
    `);
    
    console.log('--- DB TABLE CHECK ---');
    if (res.rows.length > 0) {
      console.log('SUCCESS: Table "timetable_adjustments" exists in public schema!');
      
      const columns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'timetable_adjustments';
      `);
      console.log('Columns:');
      columns.rows.forEach(col => {
        console.log(`- ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('ERROR: Table "timetable_adjustments" does NOT exist!');
    }
  } catch (err) {
    console.error('Diagnostic error:', err.message);
  } finally {
    await pool.end();
  }
}

test();
