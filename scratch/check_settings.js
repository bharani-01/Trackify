const db = require('../backend/src/config/db');
db.query("SELECT * FROM system_settings").then(r => {
  console.table(r.rows);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
