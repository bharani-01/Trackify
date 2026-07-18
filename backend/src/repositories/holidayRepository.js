const db = require('../config/db');

const getAll = async () => {
  const query = 'SELECT * FROM holidays ORDER BY date DESC';
  const result = await db.query(query);
  return result.rows;
};

const getByTarget = async (department, semester) => {
  const query = `
    SELECT * FROM holidays 
    WHERE 
      (department = $1 OR department IS NULL)
      AND (semester = $2 OR semester IS NULL)
    ORDER BY date DESC
  `;
  const result = await db.query(query, [department, semester]);
  return result.rows;
};

const getByDateAndTarget = async (date, department, semester) => {
  const query = `
    SELECT * FROM holidays 
    WHERE 
      date = $1
      AND (department = $2 OR department IS NULL)
      AND (semester = $3 OR semester IS NULL)
  `;
  const result = await db.query(query, [date, department, semester]);
  return result.rows;
};

const create = async ({ name, date, department, semester }) => {
  const query = `
    INSERT INTO holidays (name, date, department, semester)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  const result = await db.query(query, [
    name,
    date,
    department || null,
    semester ? parseInt(semester, 10) : null
  ]);
  return result.rows[0];
};

const deleteById = async (id) => {
  const query = 'DELETE FROM holidays WHERE id = $1 RETURNING *';
  const result = await db.query(query, [id]);
  return result.rows[0];
};

module.exports = {
  getAll,
  getByTarget,
  getByDateAndTarget,
  create,
  deleteById
};
