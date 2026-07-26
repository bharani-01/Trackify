const db = require('../config/db');

/**
 * Dynamically queries system table columns and records to support administrative visualization.
 */
const visualizeTable = async (req, res) => {
  try {
    const { table } = req.query;
    const SAFELIST = ['departments', 'users', 'subjects', 'timetable', 'attendance', 'settings', 'system_settings', 'holidays', 'schedule_adjustments'];

    if (!table || !SAFELIST.includes(table)) {
      return res.status(400).json({ success: false, message: 'Invalid or unauthorized database table selected.' });
    }

    // 1. Fetch table columns metadata sorted by ordinal position
    const columnsRes = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [table]);

    const columns = columnsRes.rows.map(r => ({
      name: r.column_name,
      type: r.data_type
    }));

    // 2. Determine default order sorting based on columns
    let orderClause = '';
    const hasCreatedAt = columns.some(c => c.name === 'created_at');
    const hasId = columns.some(c => c.name === 'id');
    if (hasCreatedAt) {
      orderClause = 'ORDER BY created_at DESC';
    } else if (hasId) {
      orderClause = 'ORDER BY id DESC';
    }

    // 3. Fetch rows limit to 200 to prevent browser lag or network limits
    const rowsRes = await db.query(`SELECT * FROM ${table} ${orderClause} LIMIT 200`);

    return res.status(200).json({
      success: true,
      tableName: table,
      columns,
      rows: rowsRes.rows
    });
  } catch (error) {
    console.error('[VISUALIZER CONTROLLER ERROR]:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to retrieve table data from database.' });
  }
};

module.exports = {
  visualizeTable
};
