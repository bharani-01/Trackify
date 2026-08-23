const db = require('../backend/src/config/db');

async function inspectFocused() {
  const client = await db.pool.connect();
  try {
    console.log('=== SECTION 1-4 SUMMARY ===\n');

    // 1. Overall Subjects
    const s1 = await client.query('SELECT COUNT(*) as total, COUNT(CASE WHEN user_id IS NULL THEN 1 END) as master, COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as user_custom FROM subjects');
    console.log('Subjects summary:', s1.rows[0]);

    // 2. Master duplicate check
    const s2 = await client.query(`
      SELECT COALESCE(department_id::text, department) as dept, semester, UPPER(COALESCE(subject_code, code)) as code, COUNT(*)
      FROM subjects WHERE user_id IS NULL
      GROUP BY COALESCE(department_id::text, department), semester, UPPER(COALESCE(subject_code, code))
      HAVING COUNT(*) > 1;
    `);
    console.log('Duplicate master subject groups count:', s2.rows.length);
    if (s2.rows.length > 0) console.log(s2.rows);

    // 3. User custom subjects
    const s3 = await client.query(`SELECT COUNT(*) as custom_count FROM subjects WHERE user_id IS NOT NULL;`);
    console.log('User custom subjects count:', s3.rows[0].custom_count);

    // 4. Students raw subject query check
    const users = await client.query(`SELECT id, name, email, department, semester, department_id FROM users WHERE role = 'student'`);
    console.log('Total students:', users.rows.length);
    let dupCount = 0;
    for (const u of users.rows) {
      const raw = await client.query(`
        SELECT s.id, COALESCE(s.subject_code, s.code) as code, COALESCE(s.subject_name, s.name) as name
        FROM subjects s
        WHERE (s.department_id = $1 OR (s.department_id IS NULL AND UPPER(s.department) = UPPER($2)) OR s.user_id = $3)
          AND (s.semester = $4 OR s.user_id = $3)
      `, [u.department_id, u.department, u.id, u.semester]);
      
      const counts = {};
      raw.rows.forEach(r => {
        const c = (r.code || '').trim().toUpperCase();
        counts[c] = (counts[c] || 0) + 1;
      });
      const dups = Object.entries(counts).filter(([_, c]) => c > 1);
      if (dups.length > 0) {
        dupCount++;
        console.log(`Student ${u.name} has duplicates:`, dups);
      }
    }
    console.log(`Students with duplicate subjects: ${dupCount}`);

    // 5. Multiple attendance entries on the same day
    const s5 = await client.query(`
      SELECT 
        u.name,
        TO_CHAR(a.date, 'YYYY-MM-DD') as date,
        COALESCE(s.subject_code, s.code) as code,
        COUNT(*) as cnt
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      JOIN subjects s ON a.subject_id = s.id
      GROUP BY u.name, a.date, COALESCE(s.subject_code, s.code)
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC
      LIMIT 10;
    `);
    console.log('Multiple attendance on same day sample count:', s5.rows.length);
    if (s5.rows.length > 0) console.log(s5.rows);

    // 6. Timetable slots with department_id IS NULL
    const s6 = await client.query(`
      SELECT COUNT(*) as legacy_tt_slots, COUNT(CASE WHEN department_id IS NULL THEN 1 END) as null_dept_tt
      FROM timetable;
    `);
    console.log('Timetable slots breakdown:', s6.rows[0]);

    // 7. Check timetable queries for a student
    if (users.rows.length > 0) {
      const sampleStudent = users.rows[0];
      const ttRes = await client.query(`
        SELECT t.id, t.day, t.period, COALESCE(s.subject_code, s.code) as code, t.department, t.department_id, t.semester
        FROM users u
        JOIN timetable t ON (t.department_id = u.department_id OR (u.department_id IS NULL AND t.department = u.department))
                        AND t.semester = u.semester
        LEFT JOIN subjects s ON t.subject_id = s.id
        WHERE u.id = $1
        ORDER BY t.day, t.period
      `, [sampleStudent.id]);
      console.log(`Sample Student ${sampleStudent.name} (${sampleStudent.department}, Sem ${sampleStudent.semester}) Timetable entries count:`, ttRes.rows.length);
      // Check if same day and period has multiple slots:
      const slotMap = {};
      ttRes.rows.forEach(r => {
        const key = `${r.day}_P${r.period}`;
        slotMap[key] = (slotMap[key] || 0) + 1;
      });
      const dupSlots = Object.entries(slotMap).filter(([_, c]) => c > 1);
      console.log(`Sample Student Slot collisions:`, dupSlots);
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await db.pool.end();
  }
}

inspectFocused();
