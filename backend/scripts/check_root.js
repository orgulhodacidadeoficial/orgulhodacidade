const http = require('http');
const url = process.argv[2] || 'http://localhost:3000';
http.get(url, res => {
  console.log(res.statusCode);
  res.resume();
}).on('error', e => {
  console.error('ERR', e.message);
  process.exit(1);
});
