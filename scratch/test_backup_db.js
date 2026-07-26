const { Client } = require('pg');

async function testConnection() {
  const connectionString = 'postgresql://postgres.dvzrbalqwwhrajucaslp:.trackme%40321.@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';
  const client = new Client({ connectionString });
  
  try {
    console.log('Connecting to Supabase transaction pooler...');
    await client.connect();
    console.log('Connected successfully!');
    
    const res = await client.query('SELECT version();');
    console.log('Postgres version:', res.rows[0].version);
    
    await client.end();
  } catch (error) {
    console.error('Connection failed:', error.message);
  }
}

testConnection();
