'use strict';

const packageJson = require('../package.json');
const protectedResources = require('../demo-platform/protected-resources.json');
const { auditStartCommand } = require('../demo-platform/startup-audit');

const result = auditStartCommand(packageJson.scripts?.start);
const report = {
  checkedAt: new Date().toISOString(),
  protectedRailwayProjects: protectedResources.railwayProjects,
  protectedTenants: protectedResources.protectedTenants,
  productionStartCommand: result
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!result.safeForCanonicalDemo) process.exitCode = 1;
