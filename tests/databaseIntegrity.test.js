const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config();
const db = require('../backend/src/config/db');

describe('Database Integrity & Realignment Verification', () => {

  test('Sai Vidya M (E0124054) ML Ops Lab count must strictly equal 20 conducted classes', async () => {
    const query = `
      SELECT 
        s.code,
        s.name,
        count(*) as total_conducted,
        count(CASE WHEN a.status IN ('Present', 'On Duty') THEN 1 END) as attended,
        count(CASE WHEN a.status = 'Absent' THEN 1 END) as absent
      FROM attendance a
      JOIN subjects s ON a.subject_id = s.id
      JOIN users u ON a.user_id = u.id
      WHERE u.register_number = 'E0124054'
        AND s.code = 'AIM23CL302'
      GROUP BY s.code, s.name
    `;
    const res = await db.query(query);
    assert.strictEqual(res.rows.length, 1, 'Subject AIM23CL302 must exist for Sai Vidya M');
    const labStats = res.rows[0];
    
    assert.strictEqual(
      parseInt(labStats.total_conducted, 10),
      20,
      `ML Ops Lab conducted classes should be exactly 20 (got ${labStats.total_conducted})`
    );
    assert.strictEqual(
      parseInt(labStats.attended, 10),
      20,
      `ML Ops Lab attended classes should be 20 (got ${labStats.attended})`
    );
  });

  test('Zero duplicate inflation: No subject has more than 3 attendance entries on the same date', async () => {
    const query = `
      SELECT a.user_id, a.date, a.subject_id, count(*)
      FROM attendance a
      JOIN subjects s ON a.subject_id = s.id
      GROUP BY a.user_id, a.date, a.subject_id
      HAVING count(*) > 3
    `;
    const res = await db.query(query);
    assert.strictEqual(
      res.rows.length,
      0,
      `Expected 0 over-logged subject records (> 3 on a single day), found ${res.rows.length}`
    );
  });

  test('Zero unscheduled Sunday attendance records exist across all students', async () => {
    const query = `
      SELECT 
        u.register_number,
        to_char(a.date, 'YYYY-MM-DD') as date_str,
        count(*) as entries
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE EXTRACT(DOW FROM a.date) = 0
      GROUP BY u.register_number, a.date
    `;
    const res = await db.query(query);
    assert.strictEqual(
      res.rows.length,
      0,
      `Expected 0 unscheduled Sunday records across database, found ${res.rows.length}`
    );
  });

  test('All attendance rows link to valid existing users and subjects', async () => {
    const orphanUsersRes = await db.query(`
      SELECT count(*) FROM attendance a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE u.id IS NULL
    `);
    assert.strictEqual(parseInt(orphanUsersRes.rows[0].count, 10), 0, 'No orphaned user records');

    const orphanSubjectsRes = await db.query(`
      SELECT count(*) FROM attendance a
      LEFT JOIN subjects s ON a.subject_id = s.id
      WHERE s.id IS NULL
    `);
    assert.strictEqual(parseInt(orphanSubjectsRes.rows[0].count, 10), 0, 'No orphaned subject records');
  });

  test('Cohort Timetable alignment: E01 Sem 5 Monday Lab is only on Mondays for all E01 students', async () => {
    const query = `
      SELECT 
        u.register_number,
        to_char(a.date, 'YYYY-MM-DD (Day)') as logged_day,
        count(*) as count
      FROM attendance a
      JOIN subjects s ON a.subject_id = s.id
      JOIN users u ON a.user_id = u.id
      WHERE u.department = 'E01'
        AND u.semester = 5
        AND s.code = 'AIM23CL302'
        AND EXTRACT(DOW FROM a.date) != 1
      GROUP BY u.register_number, a.date
    `;
    const res = await db.query(query);
    assert.strictEqual(
      res.rows.length,
      0,
      `Expected 0 non-Monday AIM23CL302 records for E01 Sem 5, found ${res.rows.length}`
    );
  });
});
