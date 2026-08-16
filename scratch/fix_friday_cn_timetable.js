const db = require('../backend/src/config/db');

async function fixFridayCnTimetable() {
  const client = await db.pool.connect();
  try {
    console.log('====================================================');
    console.log('=== CHECKPOINT 1: PRE-MIGRATION TIMETABLE AUDIT ===');
    console.log('====================================================\n');

    // 1. Audit cross-department timetable slots
    const crossTtRes = await client.query(`
      SELECT t.id, t.day, t.period, t.department_id as tt_dept_id, t.department as tt_dept_code, t.semester as tt_sem,
             s.id as current_sub_id, s.subject_code, s.department_id as sub_dept_id, s.department as sub_dept_code, s.semester as sub_sem,
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

    console.log(`Found ${crossTtRes.rows.length} cross-department timetable slots to fix.`);

    // 2. Audit detached attendance records
    const detachedAttRes = await client.query(`
      SELECT a.id, a.user_id, a.subject_id, a.date, a.status, a.remarks,
             u.department_id as u_dept_id, u.department as u_dept_code, u.semester as u_sem,
             s.subject_code
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      JOIN subjects s ON a.subject_id = s.id
      LEFT JOIN departments d_u ON (u.department_id = d_u.id OR UPPER(u.department) = UPPER(d_u.code))
      LEFT JOIN departments d_s ON (s.department_id = d_s.id OR UPPER(s.department) = UPPER(d_s.code))
      WHERE (d_u.id IS NOT NULL AND d_s.id IS NOT NULL AND d_u.id != d_s.id)
         OR (UPPER(COALESCE(d_u.code, u.department)) != UPPER(COALESCE(d_s.code, s.department)))
    `);

    console.log(`Found ${detachedAttRes.rows.length} detached attendance records to remap.\n`);

    console.log('====================================================');
    console.log('=== CHECKPOINT 2: EXECUTING ATOMIC TRANSACTION ===');
    console.log('====================================================\n');

    await client.query('BEGIN');

    // Step A: Remap Timetable Slots to Canonical Department Master Subjects
    const remapTtRes = await client.query(`
      UPDATE timetable
      SET subject_id = target_sub.id
      FROM subjects old_sub, departments d_tt, subjects target_sub
      WHERE timetable.subject_id = old_sub.id
        AND (timetable.department_id = d_tt.id OR UPPER(timetable.department) = UPPER(d_tt.code))
        AND (target_sub.department_id = d_tt.id OR UPPER(target_sub.department) = UPPER(d_tt.code))
        AND target_sub.semester = timetable.semester
        AND UPPER(COALESCE(target_sub.subject_code, target_sub.code)) = UPPER(COALESCE(old_sub.subject_code, old_sub.code))
        AND target_sub.user_id IS NULL
        AND (
          (old_sub.department_id IS NOT NULL AND d_tt.id IS NOT NULL AND old_sub.department_id != d_tt.id)
          OR (UPPER(COALESCE(old_sub.department, '')) != UPPER(COALESCE(d_tt.code, timetable.department, '')))
        )
      RETURNING timetable.id, timetable.day, timetable.period, timetable.department, target_sub.subject_code, target_sub.id as new_sub_id;
    `);

    console.log(`[Remapped Timetable Slots]: ${remapTtRes.rows.length} slots updated.`);
    remapTtRes.rows.forEach(r => {
      console.log(`  - Slot ID ${r.id} (${r.department} Day ${r.day} Period ${r.period}) -> Subject ${r.subject_code} (New ID: ${r.new_sub_id})`);
    });

    // Step B: Purge conflicting duplicate attendance records before remapping
    const purgeAttRes = await client.query(`
      DELETE FROM attendance a_bad
      USING attendance a_good, users u, subjects old_sub, subjects target_sub, departments d_u
      WHERE a_bad.user_id = u.id
        AND a_bad.subject_id = old_sub.id
        AND (u.department_id = d_u.id OR UPPER(u.department) = UPPER(d_u.code))
        AND target_sub.user_id IS NULL
        AND (target_sub.department_id = d_u.id OR UPPER(target_sub.department) = UPPER(d_u.code))
        AND target_sub.semester = u.semester
        AND UPPER(COALESCE(target_sub.subject_code, target_sub.code)) = UPPER(COALESCE(old_sub.subject_code, old_sub.code))
        AND a_good.user_id = a_bad.user_id
        AND a_good.subject_id = target_sub.id
        AND a_good.date = a_bad.date
        AND COALESCE(a_good.remarks, '') = COALESCE(a_bad.remarks, '')
        AND a_bad.id != a_good.id;
    `);

    console.log(`\n[Purged Conflicting Attendance Records]: ${purgeAttRes.rowCount} rows.`);

    // Step C: Remap Detached Attendance Records
    const remapAttRes = await client.query(`
      UPDATE attendance
      SET subject_id = target_sub.id
      FROM users u, departments d_u, subjects old_sub, subjects target_sub
      WHERE attendance.user_id = u.id
        AND attendance.subject_id = old_sub.id
        AND (u.department_id = d_u.id OR UPPER(u.department) = UPPER(d_u.code))
        AND (target_sub.department_id = d_u.id OR UPPER(target_sub.department) = UPPER(d_u.code))
        AND target_sub.semester = u.semester
        AND UPPER(COALESCE(target_sub.subject_code, target_sub.code)) = UPPER(COALESCE(old_sub.subject_code, old_sub.code))
        AND target_sub.user_id IS NULL
        AND (
          (old_sub.department_id IS NOT NULL AND d_u.id IS NOT NULL AND old_sub.department_id != d_u.id)
          OR (UPPER(COALESCE(old_sub.department, '')) != UPPER(COALESCE(d_u.code, u.department, '')))
        )
      RETURNING attendance.id, u.name, target_sub.subject_code, attendance.date, attendance.remarks;
    `);

    console.log(`[Remapped Attendance Logs]: ${remapAttRes.rows.length} records updated.`);

    console.log('\n====================================================');
    console.log('=== CHECKPOINT 3: COMMITTING TRANSACTION ===');
    console.log('====================================================\n');

    await client.query('COMMIT');
    console.log('[CHECKPOINT 3 PASSED]: Transaction successfully committed!');

    console.log('\n====================================================');
    console.log('=== CHECKPOINT 4: POST-MIGRATION AUDIT VERIFICATION ===');
    console.log('====================================================\n');

    // Post-migration audit
    const postTtCheck = await client.query(`
      SELECT t.id
      FROM timetable t
      JOIN subjects s ON t.subject_id = s.id
      LEFT JOIN departments d_tt ON (t.department_id = d_tt.id OR UPPER(t.department) = UPPER(d_tt.code))
      LEFT JOIN departments d_sub ON (s.department_id = d_sub.id OR UPPER(s.department) = UPPER(d_sub.code))
      WHERE (d_tt.id IS NOT NULL AND d_sub.id IS NOT NULL AND d_tt.id != d_sub.id)
         OR (UPPER(COALESCE(d_tt.code, t.department)) != UPPER(COALESCE(d_sub.code, s.department)))
    `);

    const postAttCheck = await client.query(`
      SELECT a.id
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      JOIN subjects s ON a.subject_id = s.id
      LEFT JOIN departments d_u ON (u.department_id = d_u.id OR UPPER(u.department) = UPPER(d_u.code))
      LEFT JOIN departments d_s ON (s.department_id = d_s.id OR UPPER(s.department) = UPPER(d_s.code))
      WHERE (d_u.id IS NOT NULL AND d_s.id IS NOT NULL AND d_u.id != d_s.id)
         OR (UPPER(COALESCE(d_u.code, u.department)) != UPPER(COALESCE(d_s.code, s.department)))
    `);

    if (postTtCheck.rows.length === 0 && postAttCheck.rows.length === 0) {
      console.log('[CHECKPOINT 4 PASSED]: Verified 0 cross-department timetable slots and 0 detached attendance logs remain.');
    } else {
      console.error('[CHECKPOINT 4 FAIL]: Remaining mismatched slots:', postTtCheck.rows.length, 'Remaining detached attendance:', postAttCheck.rows.length);
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[TRANSACTION ROLLED BACK DUE TO ERROR]:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

fixFridayCnTimetable();
