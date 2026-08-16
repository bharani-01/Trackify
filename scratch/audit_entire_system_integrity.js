const db = require('../backend/src/config/db');

async function auditSystemIntegrity() {
  try {
    console.log('================================================================');
    console.log('=== TRACKIFY PRODUCTION DEEP INTEGRITY AUDIT SUITE ===');
    console.log('================================================================\n');

    let totalIssuesFound = 0;

    // 1. AUDIT TIMETABLE SLOTS CROSS-DEPARTMENT & CROSS-SEMESTER
    console.log('--- AUDIT 1: Timetable Subject Cohort Match ---');
    const ttCheck = await db.query(`
      SELECT t.id, t.day, t.period, t.department as tt_dept, t.semester as tt_sem,
             s.subject_code, s.department as sub_dept, s.semester as sub_sem
      FROM timetable t
      JOIN subjects s ON t.subject_id = s.id
      LEFT JOIN departments d_tt ON (t.department_id = d_tt.id OR UPPER(t.department) = UPPER(d_tt.code))
      LEFT JOIN departments d_sub ON (s.department_id = d_sub.id OR UPPER(s.department) = UPPER(d_sub.code))
      WHERE (
        (d_tt.id IS NOT NULL AND d_sub.id IS NOT NULL AND d_tt.id != d_sub.id)
        OR (UPPER(COALESCE(d_tt.code, t.department)) != UPPER(COALESCE(d_sub.code, s.department)))
        OR (t.semester != s.semester)
      )
    `);

    if (ttCheck.rows.length === 0) {
      console.log('✓ [PASS]: 100% of timetable slots match their department & semester master subjects.');
    } else {
      totalIssuesFound += ttCheck.rows.length;
      console.error(`✕ [FAIL]: Found ${ttCheck.rows.length} mismatched timetable slots:`);
      console.table(ttCheck.rows);
    }

    // 2. AUDIT ATTENDANCE LOGS CROSS-DEPARTMENT & CROSS-SEMESTER
    console.log('\n--- AUDIT 2: Attendance Records Cohort Match ---');
    const attCheck = await db.query(`
      SELECT a.id, u.name as user_name, u.department as user_dept, u.semester as user_sem,
             s.subject_code, s.department as sub_dept, s.semester as sub_sem, a.date, a.remarks
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      JOIN subjects s ON a.subject_id = s.id
      LEFT JOIN departments d_u ON (u.department_id = d_u.id OR UPPER(u.department) = UPPER(d_u.code))
      LEFT JOIN departments d_s ON (s.department_id = d_s.id OR UPPER(s.department) = UPPER(d_s.code))
      WHERE (
        (d_u.id IS NOT NULL AND d_s.id IS NOT NULL AND d_u.id != d_s.id)
        OR (UPPER(COALESCE(d_u.code, u.department)) != UPPER(COALESCE(d_s.code, s.department)))
        OR (u.semester != s.semester)
      )
    `);

    if (attCheck.rows.length === 0) {
      console.log('✓ [PASS]: 100% of attendance records match their student department & semester master subjects.');
    } else {
      totalIssuesFound += attCheck.rows.length;
      console.error(`✕ [FAIL]: Found ${attCheck.rows.length} mismatched attendance records:`);
      console.table(attCheck.rows);
    }

    // 3. AUDIT SCHEDULE ADJUSTMENTS
    console.log('\n--- AUDIT 3: Schedule Adjustments Subject Match ---');
    const saCheck = await db.query(`
      SELECT sa.id, sa.date,
             orig.subject_code as orig_code, orig.department as orig_dept,
             adj.subject_code as adj_code, adj.department as adj_dept,
             d.code as sa_dept
      FROM schedule_adjustments sa
      LEFT JOIN subjects orig ON sa.original_subject_id = orig.id
      LEFT JOIN subjects adj ON sa.adjusted_subject_id = adj.id
      LEFT JOIN departments d ON sa.department_id = d.id
      WHERE (orig.id IS NOT NULL AND d.id IS NOT NULL AND orig.department_id != d.id AND UPPER(orig.department) != UPPER(d.code))
         OR (adj.id IS NOT NULL AND d.id IS NOT NULL AND adj.department_id != d.id AND UPPER(adj.department) != UPPER(d.code))
    `);

    if (saCheck.rows.length === 0) {
      console.log('✓ [PASS]: 100% of schedule adjustments match their department master subjects.');
    } else {
      totalIssuesFound += saCheck.rows.length;
      console.error(`✕ [FAIL]: Found ${saCheck.rows.length} mismatched schedule adjustments:`);
      console.table(saCheck.rows);
    }

    // 4. AUDIT DUPLICATE MASTER SUBJECTS
    console.log('\n--- AUDIT 4: Master Subjects Uniqueness ---');
    const dupSubCheck = await db.query(`
      SELECT COALESCE(department_id::text, department) as dept, semester, UPPER(COALESCE(subject_code, code)) as code, COUNT(*)
      FROM subjects
      WHERE user_id IS NULL
      GROUP BY COALESCE(department_id::text, department), semester, UPPER(COALESCE(subject_code, code))
      HAVING COUNT(*) > 1
    `);

    if (dupSubCheck.rows.length === 0) {
      console.log('✓ [PASS]: 100% of master subjects are unique (0 duplicate subject groups).');
    } else {
      totalIssuesFound += dupSubCheck.rows.length;
      console.error(`✕ [FAIL]: Found duplicate master subject groups:`);
      console.table(dupSubCheck.rows);
    }

    // 5. AUDIT ORPHANED TIMETABLE OR ATTENDANCE RECORDS (FOREIGN KEY INTEGRITY)
    console.log('\n--- AUDIT 5: Foreign Key Referential Integrity ---');
    const orphanTt = await db.query(`SELECT id FROM timetable WHERE subject_id IS NOT NULL AND subject_id NOT IN (SELECT id FROM subjects)`);
    const orphanAtt = await db.query(`SELECT id FROM attendance WHERE subject_id IS NOT NULL AND subject_id NOT IN (SELECT id FROM subjects)`);
    const orphanAttUser = await db.query(`SELECT id FROM attendance WHERE user_id NOT IN (SELECT id FROM users)`);

    if (orphanTt.rows.length === 0 && orphanAtt.rows.length === 0 && orphanAttUser.rows.length === 0) {
      console.log('✓ [PASS]: Foreign key referential integrity is 100% intact (0 orphaned rows).');
    } else {
      totalIssuesFound += (orphanTt.rows.length + orphanAtt.rows.length + orphanAttUser.rows.length);
      console.error(`✕ [FAIL]: Found orphaned rows: TT (${orphanTt.rows.length}), Attendance Sub (${orphanAtt.rows.length}), Attendance User (${orphanAttUser.rows.length})`);
    }

    // 6. DEPARTMENTS SUMMARY BREAKDOWN
    console.log('\n--- AUDIT 6: Department-wise Master Subjects & Timetable Count Breakdown ---');
    const deptSummary = await db.query(`
      SELECT s.department as dept_code, s.semester,
             COUNT(DISTINCT s.id) as master_subjects_count,
             (SELECT COUNT(*) FROM timetable t WHERE UPPER(t.department) = UPPER(s.department) AND t.semester = s.semester) as timetable_slots_count
      FROM subjects s
      WHERE s.user_id IS NULL
      GROUP BY s.department, s.semester
      ORDER BY s.department ASC, s.semester ASC
    `);
    console.table(deptSummary.rows);

    console.log('\n================================================================');
    if (totalIssuesFound === 0) {
      console.log('=== SYSTEM AUDIT COMPLETED: 100% PERFECT HEALTH (0 ISSUES DETECTED) ===');
    } else {
      console.error(`=== SYSTEM AUDIT COMPLETED: ${totalIssuesFound} ISSUES DETECTED ===`);
    }
    console.log('================================================================');

  } catch (err) {
    console.error('Audit Error:', err);
  } finally {
    process.exit(0);
  }
}

auditSystemIntegrity();
