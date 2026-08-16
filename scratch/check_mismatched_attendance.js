const db = require('../backend/src/config/db');

async function checkMismatchedAttendance() {
  try {
    console.log('=== CHECKING ATTENDANCE LOGS FOR MISMATCHED TIMETABLE SLOTS ===\n');

    const res = await db.query(`
      SELECT a.id, a.user_id, u.name as user_name, u.department as user_dept_code, d_u.code as user_dcode,
             a.subject_id, s.subject_code, s.department as sub_dept_code, d_s.code as sub_dcode,
             a.date, a.status, a.remarks
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      JOIN subjects s ON a.subject_id = s.id
      LEFT JOIN departments d_u ON (u.department_id = d_u.id OR UPPER(u.department) = UPPER(d_u.code))
      LEFT JOIN departments d_s ON (s.department_id = d_s.id OR UPPER(s.department) = UPPER(d_s.code))
      WHERE (d_u.id IS NOT NULL AND d_s.id IS NOT NULL AND d_u.id != d_s.id)
         OR (UPPER(COALESCE(d_u.code, u.department)) != UPPER(COALESCE(d_s.code, s.department)))
      ORDER BY a.date DESC
    `);

    console.log(`Found ${res.rows.length} attendance records logged under a different department's subject ID:`);
    console.table(res.rows.map(r => ({
      att_id: r.id,
      user_name: r.user_name,
      user_dept: r.user_dcode || r.user_dept_code,
      sub_code: r.subject_code,
      sub_dept: r.sub_dcode || r.sub_dept_code,
      date: r.date.toISOString().split('T')[0],
      status: r.status,
      remarks: r.remarks
    })));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

checkMismatchedAttendance();
