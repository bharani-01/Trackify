const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config();
const db = require('../backend/src/config/db');
const attendanceRepository = require('../backend/src/repositories/attendanceRepository');

describe('Attendance Repository - deleteFutureRecords', () => {
  let testUserId;
  let testSubjectId;

  before(async () => {
    const timestamp = Date.now().toString().slice(-6);
    const testEmail = `test-repo-${timestamp}@example.com`;
    const testRegNo = `TR${timestamp}`;

    const userRes = await db.query(`
      INSERT INTO users (name, register_number, email, password_hash, role, department, semester, is_approved)
      VALUES ('Test Student Repo', $1, $2, 'hashedpass', 'student', 'E01', 5, TRUE)
      RETURNING id
    `, [testRegNo, testEmail]);
    testUserId = userRes.rows[0].id;

    const subjectRes = await db.query(`
      INSERT INTO subjects (user_id, subject_code, subject_name, code, name, department, semester)
      VALUES ($1, 'TEST101', 'Test Subject', 'TEST101', 'Test Subject', 'E01', 5)
      RETURNING id
    `, [testUserId]);
    testSubjectId = subjectRes.rows[0].id;
  });

  test('should accurately delete only records strictly after the given reference date', async () => {
    const refDate = '2099-01-15';
    const pastDate = '2099-01-10';
    const sameDate = '2099-01-15';
    const futureDate1 = '2099-01-16';
    const futureDate2 = '2099-01-20';

    // Insert 4 test records
    const insertQuery = `
      INSERT INTO attendance (user_id, subject_id, date, status, remarks)
      VALUES 
        ($1, $2, $3, 'Present', 'Test past record'),
        ($1, $2, $4, 'Present', 'Test same-date record'),
        ($1, $2, $5, 'Absent', 'Test future record 1'),
        ($1, $2, $6, 'Present', 'Test future record 2')
    `;
    await db.query(insertQuery, [testUserId, testSubjectId, pastDate, sameDate, futureDate1, futureDate2]);

    // Verify all 4 exist
    const countBefore = await db.query(
      "SELECT count(*) FROM attendance WHERE user_id = $1",
      [testUserId]
    );
    assert.strictEqual(parseInt(countBefore.rows[0].count, 10), 4);

    // Call deleteFutureRecords with refDate
    const deletedCount = await attendanceRepository.deleteFutureRecords(testUserId, refDate);
    assert.strictEqual(deletedCount, 2, 'Should delete exactly the 2 future records');

    // Verify that pastDate and sameDate still exist
    const remaining = await db.query(
      "SELECT to_char(date, 'YYYY-MM-DD') as date_str, remarks FROM attendance WHERE user_id = $1 ORDER BY date_str",
      [testUserId]
    );
    assert.strictEqual(remaining.rows.length, 2, 'Past and same date records must be preserved');
    assert.strictEqual(remaining.rows[0].date_str, pastDate);
    assert.strictEqual(remaining.rows[0].remarks, 'Test past record');
    assert.strictEqual(remaining.rows[1].date_str, sameDate);
    assert.strictEqual(remaining.rows[1].remarks, 'Test same-date record');

    // Calling it again should delete 0 records
    const deletedAgain = await attendanceRepository.deleteFutureRecords(testUserId, refDate);
    assert.strictEqual(deletedAgain, 0, 'Subsequent execution should delete 0 records');
  });

  after(async () => {
    if (testUserId) {
      await db.query("DELETE FROM attendance WHERE user_id = $1", [testUserId]);
      await db.query("DELETE FROM subjects WHERE user_id = $1", [testUserId]);
      await db.query("DELETE FROM settings WHERE user_id = $1", [testUserId]);
      await db.query("DELETE FROM users WHERE id = $1", [testUserId]);
    }
  });
});
