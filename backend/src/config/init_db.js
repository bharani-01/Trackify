const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { pool } = require('./db');

async function initializeDatabase() {
  console.log('Starting database initialization...');
  let client;
  
  try {
    client = await pool.connect();
    console.log('Connected to database for initialization.');

    // 1. Read and run schema.sql
    const schemaPath = path.join(__dirname, '../../../sql/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Executing schema.sql DDL statements...');
    await client.query(schemaSql);
    console.log('Schema tables and triggers initialized.');

    // 2. Generate bcrypt hashes for default accounts
    console.log('Generating password hashes for seed users...');
    const saltRounds = 10;
    const adminHash = await bcrypt.hash('adminpassword', saltRounds);
    const studentHash = await bcrypt.hash('studentpassword', saltRounds);

    // 3. Read and replace placeholders in seed.sql
    const seedPath = path.join(__dirname, '../../../sql/seed.sql');
    let seedSql = fs.readFileSync(seedPath, 'utf8');
    
    seedSql = seedSql
      .replace('__ADMIN_PASSWORD_HASH__', adminHash)
      .replace('__STUDENT_PASSWORD_HASH__', studentHash);

    console.log('Executing seed.sql DML statements...');
    await client.query(seedSql);
    console.log('Database seeded successfully!');
    
    console.log('Database initialization completed successfully!');
  } catch (error) {
    console.error('Error during database initialization:', error);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    // Close the pool connection to let the process exit
    await pool.end();
  }
}

initializeDatabase();
