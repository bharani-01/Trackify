const { Client } = require('pg');

const SUPABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.xjmruzikomdudigfegyo:.trackme%40321.@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';

async function publishNotice() {
  const client = new Client({ connectionString: SUPABASE_URL });
  await client.connect();

  const title = 'Action Required: Switch Account Email to Personal Email ID';
  const content = `Notice to All Registered Users:

If you registered your Trackify account using an institutional or college email address (such as @sriher.edu.in), please update your account email to a private personal email ID (e.g. Gmail) under Profile Settings immediately.

Reason for Update:
Institutional email accounts are monitored and administered by the college IT department. To ensure your personal privacy, account security, and confidential delivery of system notifications and password reset links, we strongly advise using a private personal email address.

How to Update:
1. Open the Profile / Settings panel.
2. Update your Email Address to your private personal email.
3. Save changes.

Thank you for your prompt cooperation.`;

  const query = `
    INSERT INTO announcements (title, content, category, priority, is_pinned)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, title, created_at;
  `;

  const res = await client.query(query, [title, content, 'Emergency', 'urgent', true]);
  console.log('✅ ANNOUNCEMENT PUBLISHED TO SUPABASE SUCCESSFULLY!');
  console.log('ID:', res.rows[0].id);
  console.log('Title:', res.rows[0].title);
  console.log('Published At:', res.rows[0].created_at);

  await client.end();
}

publishNotice();
