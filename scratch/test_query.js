const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('supabase') || connectionString.includes('pooler') ? { rejectUnauthorized: false } : false
});

async function main() {
  try {
    console.log('Querying one student stats...');
    const studentId = '11d8b1b0-f602-49f8-8373-1cc102adba4c'; // Swaminathan
    const startDate = '2026-07-10';
    const endDate = '2026-07-24';

    const query = `
      SELECT 
        s.id AS subject_id,
        COALESCE(s.subject_code, s.code) AS subject_code,
        COALESCE(s.subject_name, s.name) AS subject_name,
        COALESCE(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END), 0)::int AS present_count,
        COALESCE(SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END), 0)::int AS absent_count,
        COALESCE(SUM(CASE WHEN a.status = 'Medical Leave' THEN 1 ELSE 0 END), 0)::int AS medical_count,
        COALESCE(SUM(CASE WHEN a.status = 'Holiday' THEN 1 ELSE 0 END), 0)::int AS holiday_count,
        COALESCE(SUM(CASE WHEN a.status = 'On Duty' THEN 1 ELSE 0 END), 0)::int AS od_count,
        COALESCE(SUM(CASE WHEN a.status IN ('Present', 'Absent', 'On Duty') THEN 1 ELSE 0 END), 0)::int AS conducted_count
      FROM users u
      JOIN subjects s ON (s.department_id = u.department_id OR (u.department_id IS NULL AND s.department = u.department))
                      AND s.semester = u.semester
      LEFT JOIN attendance a ON s.id = a.subject_id AND a.user_id = u.id AND a.date >= $2 AND a.date <= $3
      WHERE u.id = $1
      GROUP BY s.id, s.subject_code, s.code, s.subject_name, s.name
      ORDER BY COALESCE(s.subject_name, s.name) ASC
    `;

    const res = await pool.query(query, [studentId, startDate, endDate]);
    console.log('Query completed successfully!');
    console.table(res.rows);
  } catch (err) {
    console.error('Query error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
