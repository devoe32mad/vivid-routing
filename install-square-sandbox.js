'use strict';
const fs = require('node:fs');
const path = require('node:path');
const marker = '// Square Sandbox connection routes';
function install(source) {
  if (source.includes(marker)) return source;
  const anchor = 'app.listen(port, () => {';
  if (source.split(anchor).length !== 2) throw new Error('Server startup marker changed');
  return source.replace(anchor, marker + "\nrequire('./square-sandbox').install({app, q, requireAdvertiserCustomerManager});\n" + anchor);
}
if (require.main === module) {
  const file = path.join(__dirname, 'server.js');
  const old = fs.readFileSync(file, 'utf8');
  const next = install(old);
  if (next !== old) fs.writeFileSync(file, next);
}
module.exports = {install};
