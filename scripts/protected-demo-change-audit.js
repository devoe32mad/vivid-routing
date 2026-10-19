'use strict';

const { execFileSync } = require('node:child_process');
const { auditChangedPaths } = require('../demo-platform/protected-change-audit');

function gitPaths(args) {
  const output = execFileSync('git', args, { encoding: 'utf8' });
  return output.split('\n').filter(Boolean);
}

const paths = [
  ...gitPaths(['diff', '--name-only', 'HEAD']),
  ...gitPaths(['diff', '--cached', '--name-only']),
  ...gitPaths(['ls-files', '--others', '--exclude-standard'])
];
const result = auditChangedPaths(paths);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.safe) process.exitCode = 1;
