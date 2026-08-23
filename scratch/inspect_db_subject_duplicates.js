const db = require('../backend/src/config/db');

async function inspectDatabase() {
  const client = await db.pool.connect();
  try {
    console.log('=== [100% READ-ONLY] PRODUCTION DATABASE SUBJECT INTEGRITY AUDIT ===\n');

    // 1. Check all subjects in the database
    const subjectsSummary = await client.query(`
      SELECT 
        COUNT(*) as total_subjects,
        COUNT(CASE WHEN user_id IS NULL THEN 1 END) as master_subjects,
        COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as user_specific_subjects
      FROM subjects;
    `);
    console.log('1. Subjects Table Overall Count:');
    console.table(subjectsSummary.rows);

    // 2. Check for duplicate master subjects (same department & semester & subject code)
    const dupMasterSubjects = await client.query(`
      SELECT 
        COALESCE(s.department_id::text, s.department) as dept,
        s.semester,
        UPPER(COALESCE(s.subject_code, s.code)) as code,
        COUNT(*) as count,
        array_agg(s.id) as subject_ids,
        array_agg(s.subject_name) as names
      FROM subjects s
      WHERE s.user_id IS NULL
      GROUP BY COALESCE(s.department_id::text, s.department), s.semester, UPPER(COALESCE(s.subject_code, s.code))
      HAVING COUNT(*) > 1;
    `);
    console.log('\n2. Duplicate Master Subjects Groups (user_id IS NULL):');
    if (dupMasterSubjects.rows.length === 0) {
      console.log('  -> NONE. All master subjects are unique per department & semester.');
    } else {
      console.table(dupMasterSubjects.rows);
    }

    // 3. Check for user-specific custom subjects (user_id IS NOT NULL)
    const userCustomSubjects = await client.query(`
      SELECT 
        s.id as subject_id,
        s.user_id,
        u.name as user_name,
        u.email as user_email,
        u.department as user_dept,
        u.semester as user_sem,
        COALESCE(s.subject_code, s.code) as subject_code,
        COALESCE(s.subject_name, s.name) as subject_name,
        s.created_at
      FROM subjects s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.user_id IS NOT NULL;
    `);
    console.log('\n3. User-Specific Custom Subjects (user_id IS NOT NULL):');
    if (userCustomSubjects.rows.length === 0) {
      console.log('  -> NONE. No user-specific custom subjects exist.');
    } else {
      console.table(userCustomSubjects.rows);
    }

    // 4. Check for any user where querying their subjects produces duplicates
    // Test for each student user in the database
    const usersRes = await client.query(`
      SELECT id, name, email, department, semester, department_id 
      FROM users 
      WHERE role = 'student'
      ORDER BY name ASC;
    `);
    console.log(`\n4. Auditing subject list for all ${usersRes.rows.length} students:`);

    let anyStudentWithDuplicates = false;
    for (const u of usersRes.rows) {
      // Query without DISTINCT ON to see raw matches
      const rawSubjects = await client.query(`
        SELECT s.id, COALESCE(s.subject_code, s.code) as code, COALESCE(s.subject_name, s.name) as name, s.user_id, s.department, s.semester
        FROM subjects s
        WHERE (s.department_id = $1 OR (s.department_id IS NULL AND UPPER(s.department) = UPPER($2)) OR s.user_id = $3)
          AND (s.semester = $4 OR s.user_id = $3)
      `, [u.department_id, u.department, u.id, u.semester]);

      // Check if codes appear more than once
      const codeCounts = {};
      rawSubjects.rows.forEach(r => {
        const c = (r.code || '').trim().toUpperCase();
        codeCounts[c] = (codeCounts[c] || 0) + 1;
      });

      const duplicates = Object.entries(codeCounts).filter(([_, count]) => count > 1);
      if (duplicates.length > 0) {
        anyStudentWithDuplicates = true;
        console.log(`  [!] Student ${u.name} (${u.email}) [Dept: ${u.department}, Sem: ${u.semester}] has ${duplicates.length} duplicate subjects:`);
        duplicates.forEach(([c, cnt]) => console.log(`      - Code '${c}': appears ${cnt} times`));
      }
    }
    if (!anyStudentWithDuplicates) {
      console.log('  -> All students have clean, non-duplicate subject lists under current department/semester.');
    }

    // 5. Check attendance table: Are there users with multiple attendance records on the same date for the same subject?
    const multipleAttendancePerDay = await client.query(`
      SELECT 
        a.user_id,
        u.name as user_name,
        u.email,
        TO_CHAR(a.date, 'YYYY-MM-DD') as date,
        COALESCE(s.subject_code, s.code) as subject_code,
        COALESCE(s.subject_name, s.name) as subject_name,
        COUNT(*) as records_on_same_day,
        array_agg(a.status) as statuses,
        array_agg(a.remarks) as remarks
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      JOIN subjects s ON a.subject_id = s.id
      GROUP BY a.user_id, u.name, u.email, a.date, COALESCE(s.subject_code, s.code), COALESCE(s.subject_name, s.name)
      HAVING COUNT(*) > 1
      ORDER BY a.date DESC
      LIMIT 20;
    `);
    console.log('\n5. Attendance Records with Same Subject Logged Multiple Times on Same Date:');
    if (multipleAttendancePerDay.rows.length === 0) {
      console.log('  -> NONE. No multiple attendance records on same date.');
    } else {
      console.log(`  -> Found ${multipleAttendancePerDay.rows.length} instances where a student has multiple logs for the same subject on the same day:`);
      console.table(multipleAttendancePerDay.rows.map(r => ({
        user_name: r.user_name,
        date: r.date,
        subject: `${r.subject_code} (${r.subject_name})`,
        count: r.records_on_same_day,
        statuses: r.statuses.join(', '),
        remarks: r.remarks.join(', ')
      })));
    }

    // 6. Check for orphaned attendance records (attendance pointing to non-existent subject_id)
    const orphanedAtt = await client.query(`
      SELECT COUNT(*) as orphaned_count
      FROM attendance a
      LEFT JOIN subjects s ON a.subject_id = s.id
      WHERE s.id IS NULL;
    `);
    console.log('\n6. Orphaned Attendance Records (attendance without valid subject):');
    console.table(orphanedAtt.rows);

    // 7. Check for department / semester mismatches in users vs departments table
    const deptMismatch = await client.query(`
      SELECT u.id, u.name, u.email, u.department, u.department_id, d.code as dept_code, d.name as dept_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.department_id IS NOT NULL AND UPPER(TRIM(u.department)) != UPPER(TRIM(d.code));
    `);
    console.log('\n7. User Department Text vs Department Table ID Mismatches:');
    if (deptMismatch.rows.length === 0) {
      console.log('  -> NONE. Department text matches department_id perfectly.');
    } else {
      console.table(deptMismatch.rows);
    }

    // 8. Timetable check: Any timetable slots with multiple periods or duplicates
    const timetableDuplicates = await client.query(`
      SELECT 
        COALESCE(t.department_id::text, t.department) as dept,
        t.semester,
        t.day,
        t.period,
        COUNT(*) as slot_count,
        array_agg(t.id) as slot_ids,
        array_agg(COALESCE(s.subject_code, s.code)) as subject_codes
      FROM timetable t
      LEFT JOIN subjects s ON t.subject_id = s.id
      GROUP BY COALESCE(t.department_id::text, t.department), t.semester, t.day, t.period
      HAVING COUNT(*) > 1;
    `);
    console.log('\n8. Timetable Conflicting Slots (same department, semester, day, period):');
    if (timetableDuplicates.rows.length === 0) {
      console.log('  -> NONE. Timetable has 0 slot collisions.');
    } else {
      console.table(timetableDuplicates.rows);
    }

    console.log('\n=== AUDIT COMPLETE ===');
  } catch (err) {
    console.error('Audit Error:', err);
  } finally {
    client.release();
    await db.pool.end();
  }
}

inspectDatabase();
