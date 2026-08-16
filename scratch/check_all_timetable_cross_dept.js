const db = require('../backend/src/config/db');

async function checkCrossDeptTT() {
  try {
    console.log('=== CHECKING ALL TIMETABLE SLOTS FOR CROSS-DEPARTMENT SUBJECT REFERENCES ===\n');

    const res = await db.query(`
      SELECT t.id, t.day, t.period, t.department_id as tt_dept_id, t.department as tt_dept_code, t.semester as tt_sem,
             s.id as sub_id, s.subject_code, s.department_id as sub_dept_id, s.department as sub_dept_code, s.semester as sub_sem,
             d_tt.code as tt_dcode, d_sub.code as sub_dcode
      FROM timetable t
      JOIN subjects s ON t.subject_id = s.id
      LEFT JOIN departments d_tt ON (t.department_id = d_tt.id OR UPPER(t.department) = UPPER(d_tt.code))
      LEFT JOIN departments d_sub ON (s.department_id = d_sub.id OR UPPER(s.department) = UPPER(d_sub.code))
      WHERE (
        (d_tt.id IS NOT NULL AND d_sub.id IS NOT NULL AND d_tt.id != d_sub.id)
        OR (UPPER(COALESCE(d_tt.code, t.department)) != UPPER(COALESCE(d_sub.code, s.department)))
      )
      ORDER BY t.department, t.day, t.period
    `);

    console.log(`Found ${res.rows.length} cross-department timetable slots:`);
    console.table(res.rows.map(r => ({
      tt_id: r.id,
      day: r.day,
      period: r.period,
      tt_dept: r.tt_dcode || r.tt_dept_code,
      sub_code: r.subject_code,
      sub_dept: r.sub_dcode || r.sub_dept_code,
      sub_id: r.sub_id
    })));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

checkCrossDeptTT();
