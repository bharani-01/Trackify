const db = require('../backend/src/config/db');
const visualizer = require('../backend/src/controllers/visualizerController');

async function test() {
  const req = {
    query: {
      table: 'users'
    }
  };
  const res = {
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.data = data;
      return this;
    }
  };
  
  await visualizer.visualizeTable(req, res);
  console.log('Status code:', res.statusCode);
  console.log('Success:', res.data.success);
  console.log('Columns count:', res.data.columns.length);
  console.log('Columns sample:', res.data.columns.slice(0, 3));
  console.log('Rows count:', res.data.rows.length);
  process.exit(0);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
