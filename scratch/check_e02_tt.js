const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('supabase') || connectionString.includes('pooler') ? { rejectUnauthorized: false } : false
});

async function main() {
  try {
    const res = await pool.query(`
      SELECT t.id, t.day, t.period, t.subject_id, s.subject_code, s.subject_name, s.created_at
      FROM timetable t
      JOIN subjects s ON t.subject_id = s.id
      WHERE (t.department = 'E02' OR t.department_id = '9785ca8a-ddf5-4448-8025-ff2913cde7bc') AND t.semester = 5
      ORDER BY t.day, t.period
    `);
    console.log('--- E02 TIMETABLE SLOTS AND SUBJECT CREATION DATES ---');
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
