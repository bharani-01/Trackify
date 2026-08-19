const { Client } = require('pg');
require('dotenv').config();

async function releaseLocks() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('--- CHECKING PG ADVISORY LOCKS ---');
    const locks = await client.query(`
      SELECT pid, locktype, mode, granted 
      FROM pg_locks 
      WHERE locktype = 'advisory'
    `);
    console.table(locks.rows);

    if (locks.rows.length > 0) {
      for (const l of locks.rows) {
        console.log(`Terminating PID holding advisory lock: ${l.pid}`);
        await client.query('SELECT pg_terminate_backend($1)', [l.pid]);
      }
    } else {
      console.log('No active advisory locks found.');
    }

  } catch (err) {
    console.error('Error releasing locks:', err);
  } finally {
    await client.end();
    process.exit(0);
  }
}

releaseLocks();
