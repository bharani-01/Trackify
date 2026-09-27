const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false
});

async function run() {
  try {
    // Exact lab counts per student
    const res = await pool.query(
      `SELECT u.register_number, u.name,
              COUNT(a.id) FILTER (WHERE s.subject_code = 'AIM23CL302') as ml_lab_count,
              COUNT(a.id) FILTER (WHERE s.subject_code = 'AIM23CL301') as rl_lab_count,
              COUNT(a.id) FILTER (WHERE s.subject_code = 'CSE23CL301') as cn_lab_count,
              COUNT(a.id) FILTER (WHERE s.subject_code = 'AIM23DLU01') as da_lab_count,
              COUNT(a.id) FILTER (WHERE s.subject_code = 'AIM23CT302') as ml_theory_count
       FROM users u
       LEFT JOIN attendance a ON u.id = a.user_id
       LEFT JOIN subjects s ON a.subject_id = s.id
       WHERE u.department = 'E01' AND u.semester = 5
       GROUP BY u.id, u.register_number, u.name
       ORDER BY u.register_number`
    );

    console.log('=== ALL LAB & THEORY COUNTS FOR E01 SEM 5 COHORT ===');
    console.table(res.rows);

    // Let's inspect each student's ML Lab dates (AIM23CL302)
    const allLabLogs = await pool.query(
      `SELECT u.register_number, TO_CHAR(a.date, 'YYYY-MM-DD') as date, TO_CHAR(a.date, 'Dy') as day_name,
              a.remarks, a.status, a.created_at
       FROM attendance a
       JOIN subjects s ON a.subject_id = s.id
       JOIN users u ON a.user_id = u.id
       WHERE s.subject_code = 'AIM23CL302' AND u.department = 'E01' AND u.semester = 5
       ORDER BY a.date, a.remarks, u.register_number`
    );

    // Group by date
    const dateMap = {};
    allLabLogs.rows.forEach(r => {
      const key = `${r.date} (${r.day_name.trim()})`;
      if (!dateMap[key]) dateMap[key] = [];
      dateMap[key].push(`${r.register_number} (${r.remarks}: ${r.status})`);
    });

    console.log('\n=== ML LAB (AIM23CL302) LOGGED DATES BREAKDOWN ===');
    Object.keys(dateMap).forEach(k => {
      console.log(`${k} -> ${dateMap[k].length} records:`);
      console.log(`   Students: ${dateMap[k].join(', ')}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
