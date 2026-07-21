const db = require('../config/db');

class AnnouncementRepository {
  async create({ title, content, category = 'General', priority = 'normal', department_id = null, department = null, semester = null, posted_by = null, is_pinned = false, expires_at = null }) {
    const query = `
      INSERT INTO announcements (title, content, category, priority, department_id, department, semester, posted_by, is_pinned, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    const values = [
      title,
      content,
      category,
      priority,
      department_id || null,
      department || null,
      semester ? parseInt(semester, 10) : null,
      posted_by || null,
      is_pinned === true || is_pinned === 'true',
      expires_at || null
    ];
    const res = await db.query(query, values);
    return res.rows[0];
  }

  async getByStudentContext({ department_id = null, semester = null }) {
    const query = `
      SELECT a.*, d.code AS department_code, d.name AS department_name, u.name AS author_name
      FROM announcements a
      LEFT JOIN departments d ON a.department_id = d.id
      LEFT JOIN users u ON a.posted_by = u.id
      WHERE (a.department_id = $1 OR a.department_id IS NULL)
        AND (a.semester = $2 OR a.semester IS NULL)
        AND (a.expires_at IS NULL OR a.expires_at > CURRENT_TIMESTAMP)
      ORDER BY a.is_pinned DESC, a.created_at DESC;
    `;
    const values = [department_id || null, semester ? parseInt(semester, 10) : null];
    const res = await db.query(query, values);
    return res.rows;
  }

  async getAllAdmin() {
    const query = `
      SELECT a.*, d.code AS department_code, d.name AS department_name, u.name AS author_name
      FROM announcements a
      LEFT JOIN departments d ON a.department_id = d.id
      LEFT JOIN users u ON a.posted_by = u.id
      ORDER BY a.is_pinned DESC, a.created_at DESC;
    `;
    const res = await db.query(query);
    return res.rows;
  }

  async getById(id) {
    const query = `SELECT * FROM announcements WHERE id = $1;`;
    const res = await db.query(query, [id]);
    return res.rows[0];
  }

  async update(id, { title, content, category, priority, department_id, semester, is_pinned }) {
    const query = `
      UPDATE announcements
      SET title = COALESCE($2, title),
          content = COALESCE($3, content),
          category = COALESCE($4, category),
          priority = COALESCE($5, priority),
          department_id = $6,
          semester = $7,
          is_pinned = COALESCE($8, is_pinned),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    const values = [
      id,
      title,
      content,
      category,
      priority,
      department_id || null,
      semester ? parseInt(semester, 10) : null,
      is_pinned === undefined ? null : (is_pinned === true || is_pinned === 'true')
    ];
    const res = await db.query(query, values);
    return res.rows[0];
  }

  async delete(id) {
    const query = `DELETE FROM announcements WHERE id = $1 RETURNING *;`;
    const res = await db.query(query, [id]);
    return res.rows[0];
  }
}

module.exports = new AnnouncementRepository();
