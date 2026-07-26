const db = require('../config/db');

const getDatabaseDiagnostics = async (req, res) => {
  try {
    const startTime = Date.now();
    // Test the database query
    await db.query('SELECT 1');
    const latency = Date.now() - startTime;

    // Get current database name
    const dbNameResult = await db.query('SELECT current_database()');
    const dbName = dbNameResult.rows[0]?.current_database || 'Unknown';

    // Get client connection statistics from pg_stat_activity
    // Total connections to this DB, and active/idle connections
    const connStatsResult = await db.query(`
      SELECT 
        count(*) as total,
        count(*) FILTER (WHERE state = 'active') as active,
        count(*) FILTER (WHERE state = 'idle') as idle
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `);
    
    const dbStats = connStatsResult.rows[0] || { total: 0, active: 0, idle: 0 };

    // Get pool properties from the Node pg Pool instance
    const poolStats = {
      totalCount: db.pool ? db.pool.totalCount : 0,
      idleCount: db.pool ? db.pool.idleCount : 0,
      waitingCount: db.pool ? db.pool.waitingCount : 0,
      max: db.pool ? db.pool.options.max : 0
    };

    // Mask/sanitize database host details
    let host = 'Unknown';
    if (db.pool && db.pool.options && db.pool.options.connectionString) {
      try {
        const u = new URL(db.pool.options.connectionString);
        host = u.host; // includes domain:port or host:port, password/user credentials excluded
      } catch (e) {
        host = db.pool.options.host || 'Localhost';
      }
    } else if (db.pool && db.pool.options) {
      host = db.pool.options.host || 'Localhost';
    }

    return res.status(200).json({
      success: true,
      diagnostics: {
        status: 'Connected',
        host: host,
        databaseName: dbName,
        health: 'Healthy',
        latencyMs: latency,
        connections: {
          total: parseInt(dbStats.total, 10) || 0,
          active: parseInt(dbStats.active, 10) || 0,
          idle: parseInt(dbStats.idle, 10) || 0
        },
        pool: poolStats
      }
    });
  } catch (error) {
    console.error('Database diagnostics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve database diagnostics',
      error: error.message
    });
  }
};

const pingDatabase = async (req, res) => {
  try {
    const startTime = Date.now();
    await db.query('SELECT 1');
    const latency = Date.now() - startTime;
    return res.status(200).json({
      success: true,
      latencyMs: latency
    });
  } catch (error) {
    console.error('Database ping error:', error);
    return res.status(500).json({
      success: false,
      message: 'Database ping failed',
      error: error.message
    });
  }
};

module.exports = {
  getDatabaseDiagnostics,
  pingDatabase
};
