const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config();
const db = require('../backend/src/config/db');
const attendanceController = require('../backend/src/controllers/attendanceController');
const adminController = require('../backend/src/controllers/adminController');

describe('Attendance Controllers - clearFutureAttendance & clearStudentFutureAttendance', () => {
  let testStudentId;
  let testStudent;
  let testAdmin;
  let testSubjectId;

  before(async () => {
    // 1. Create dedicated test student with unique register_number
    const timestamp = Date.now().toString().slice(-6);
    const testEmail = `test-ctrl-${timestamp}@example.com`;
    const testRegNo = `TC${timestamp}`;

    const studentRes = await db.query(`
      INSERT INTO users (name, register_number, email, password_hash, role, department, semester, is_approved)
      VALUES ('Test Student Controller', $1, $2, 'hashedpass', 'student', 'E01', 5, TRUE)
      RETURNING *
    `, [testRegNo, testEmail]);
    testStudent = studentRes.rows[0];
    testStudentId = testStudent.id;

    // 2. Fetch admin
    const adminRes = await db.query("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
    if (adminRes.rows.length === 0) throw new Error('No test admin found');
    testAdmin = adminRes.rows[0];

    // 3. Create test subject
    const subjectRes = await db.query(`
      INSERT INTO subjects (user_id, subject_code, subject_name, code, name, department, semester)
      VALUES ($1, 'TEST202', 'Test Subject 202', 'TEST202', 'Test Subject 202', 'E01', 5)
      RETURNING id
    `, [testStudentId]);
    testSubjectId = subjectRes.rows[0].id;
  });

  test('Student self-service clearFutureAttendance removes future dates and leaves past intact', async () => {
    // Insert 1 past record (2020-01-01) and 2 far-future records (2099-12-01, 2099-12-02)
    await db.query(`
      INSERT INTO attendance (user_id, subject_id, date, status, remarks)
      VALUES 
        ($1, $2, '2020-01-01', 'Present', 'Past record'),
        ($1, $2, '2099-12-01', 'Present', 'Future record 1'),
        ($1, $2, '2099-12-02', 'Absent', 'Future record 2')
    `, [testStudentId, testSubjectId]);

    let responseStatus = null;
    let responseJson = null;

    const req = {
      user: { id: testStudentId, email: testStudent.email, name: testStudent.name },
      ip: '127.0.0.1',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' }
    };

    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseJson = data;
        return this;
      }
    };

    await attendanceController.clearFutureAttendance(req, res);

    assert.strictEqual(responseStatus, 200);
    assert.strictEqual(responseJson.success, true);
    assert.strictEqual(responseJson.count, 2, 'Should report exactly 2 deleted future records');

    // Verify database: past record exists, future records deleted
    const pastCheck = await db.query("SELECT count(*) FROM attendance WHERE user_id = $1 AND date = '2020-01-01'", [testStudentId]);
    assert.strictEqual(parseInt(pastCheck.rows[0].count, 10), 1, 'Past record must remain untouched');

    const futureCheck = await db.query("SELECT count(*) FROM attendance WHERE user_id = $1 AND date >= '2099-01-01'", [testStudentId]);
    assert.strictEqual(parseInt(futureCheck.rows[0].count, 10), 0, 'Future records must be wiped');
  });

  test('Admin clearStudentFutureAttendance allows admin to clear any target student future records', async () => {
    // Wait slightly to ensure previous async audit log finishes
    await new Promise(resolve => setTimeout(resolve, 100));

    // Insert 2 far-future records for student
    await db.query(`
      INSERT INTO attendance (user_id, subject_id, date, status, remarks)
      VALUES 
        ($1, $2, '2099-11-10', 'Present', 'Future 1'),
        ($1, $2, '2099-11-11', 'On Duty', 'Future 2')
    `, [testStudentId, testSubjectId]);

    let responseStatus = null;
    let responseJson = null;

    const req = {
      user: { id: testAdmin.id, email: testAdmin.email, role: 'admin' },
      params: { id: testStudentId },
      ip: '127.0.0.1',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' }
    };

    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseJson = data;
        return this;
      }
    };

    await adminController.clearStudentFutureAttendance(req, res);

    assert.strictEqual(responseStatus, 200);
    assert.strictEqual(responseJson.success, true);
    assert.strictEqual(responseJson.count, 2);

    const check = await db.query("SELECT count(*) FROM attendance WHERE user_id = $1 AND date >= '2099-01-01'", [testStudentId]);
    assert.strictEqual(parseInt(check.rows[0].count, 10), 0);
  });

  test('Admin clearStudentFutureAttendance returns 404 for nonexistent student ID', async () => {
    let responseStatus = null;
    let responseJson = null;

    const req = {
      user: { id: testAdmin.id, email: testAdmin.email, role: 'admin' },
      params: { id: '00000000-0000-0000-0000-000000000000' },
      ip: '127.0.0.1',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' }
    };

    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseJson = data;
        return this;
      }
    };

    await adminController.clearStudentFutureAttendance(req, res);

    assert.strictEqual(responseStatus, 404);
    assert.strictEqual(responseJson.success, false);
  });

  after(async () => {
    // Wait for any async audit log to finish
    await new Promise(resolve => setTimeout(resolve, 100));
    if (testStudentId) {
      await db.query("DELETE FROM attendance WHERE user_id = $1", [testStudentId]);
      await db.query("DELETE FROM subjects WHERE user_id = $1", [testStudentId]);
      await db.query("DELETE FROM settings WHERE user_id = $1", [testStudentId]);
      await db.query("DELETE FROM users WHERE id = $1", [testStudentId]);
    }
  });
});
