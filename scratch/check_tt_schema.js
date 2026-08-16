const db = require('../backend/src/config/db');

async function inspectTable() {
  try {
    // 1. Get column names of timetable
    const cols = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'timetable'
      ORDER BY ordinal_position
    `);
    console.log('--- TIMETABLE COLUMNS ---');
    console.table(cols.rows);

    // 2. Get E02 timetable rows
    const ttRes = await db.query(`
      SELECT t.*, s.subject_code, s.code, s.subject_name, s.name
      FROM timetable t
      LEFT JOIN subjects s ON t.subject_id = s.id
      JOIN departments d ON (t.department_id = d.id OR UPPER(t.department) = UPPER(d.code))
      WHERE (UPPER(d.code) = 'E02' OR t.department_id::text = '9785ca8a-ddf5-4448-8025-ff2913cde7bc')
        AND t.semester = 5
      ORDER BY t.day, t.period
    `);

    console.log('\n--- ALL E02 TIMETABLE ROWS ---');
    console.table(ttRes.rows.map(r => ({
      id: r.id,
      day: r.day,
      period: r.period,
      subject_id: r.subject_id,
      code: r.subject_code || r.code,
      name: r.subject_name || r.name
    })));

    // 3. Check Friday specifically (day = 5 OR day = "Friday" OR day = "friday")
    console.log('\n--- FRIDAY SLOTS (day = 5 OR day = "Friday" OR day = "friday") ---');
    const fridaySlots = ttRes.rows.filter(r => String(r.day).toLowerCase() === 'friday' || String(r.day) === '5');
    console.table(fridaySlots.map(r => ({
      id: r.id,
      day: r.day,
      period: r.period,
      subject_id: r.subject_id,
      code: r.subject_code || r.code,
      name: r.subject_name || r.name
    })));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

inspectTable();
