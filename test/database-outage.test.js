'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

for (const stage of ['ready', 'due', 'sync']) {
  test(`YouTube survives ${stage} connection reset and retries next tick`, async () => {
    let fail = true, imports = 0;
    const warnings = [], timers = [];
    const disconnect = () => { throw Object.assign(Error('private connection details'), {code:'ECONNRESET'}); };
    const store = {
      async ready() { if (fail && stage === 'ready') disconnect(); },
      async due() { if (fail && stage === 'due') disconnect(); return [{owner_user_id:1,id:2}]; },
      async sync() { if (fail && stage === 'sync') disconnect(); imports++; }
    };
    const context = {
      module:{exports:{}}, process, console, fetch,
      setTimeout(fn) { timers.push(fn); return {unref(){}}; },
      setInterval(fn) { timers.push(fn); return {unref(){}}; },
      require(name) {
        if (name === './youtube-analytics-store') return {createStore:()=>store};
        if (name === './youtube-analytics-readonly') return {configuration:()=>({}),createReader:()=>({})};
        if (name === './marketing-command-center') return {};
        return require(name);
      }
    };
    vm.runInNewContext(fs.readFileSync(path.join(root,'youtube-analytics-routes.js'),'utf8'),context);
    context.module.exports.registerYouTubeAnalyticsRoutes({
      app:{get(){},post(){}}, env:{YOUTUBE_ANALYTICS_ENABLED:'true'},
      logger:{warn:message=>warnings.push(message)}
    });
    assert.equal(timers.length,2);
    await assert.doesNotReject(timers[0]());
    assert.equal(imports,0);
    assert.deepEqual(warnings,['youtube_analytics_auto_sync_failure ECONNRESET']);
    fail=false;
    await timers[1]();
    assert.equal(imports,1);
  });
}

test('normal marketplace bootstrap starts app without opening seed database connections', async () => {
  const calls=[];
  const express = () => {};
  const requireMock = name => {
    if(name==='pg') return {Pool:class {constructor(){throw Error('seed database must not be used');}}};
    if(name==='express') return express;
    calls.push(name);
  };
  requireMock.resolve = name=>name;
  requireMock.cache = {express:{exports:express}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'mca-marketplace-concept.js'),'utf8'), {
    require:requireMock, process:{env:{DATABASE_URL:'test'},argv:[]}, console
  });
  assert.deepEqual(calls,['./asset-bootstrap']);
  assert.notEqual(requireMock.cache.express.exports,express);
});

test('startup retains code installers and excludes optional data jobs', () => {
  const {scripts}=require('../package.json');
  for(const name of ['sjn-marketplace-polish','mca-marketplace-images','seed-jim-evaluation']) {
    assert.ok(!scripts.start.includes(name));
  }
  assert.ok(scripts.start.includes('install-evaluation-presentation.js'));
  assert.ok(scripts.start.endsWith('node mca-marketplace-concept.js'));
  assert.ok(scripts['maintenance:marketplace'].includes('--seed-only'));
});

test('shared pool handles idle connection errors without exposing connection details', () => {
  const {install}=require('../install-pool-error-handler');
  const source=install(fs.readFileSync(path.join(root,'server.js'),'utf8'));
  assert.equal(install(source),source);
  const handlers={}, messages=[];
  const pool={on:(event,handler)=>{handlers[event]=handler;}};
  vm.runInNewContext(source.slice(source.indexOf('pool.on("error"'),source.indexOf('app.set("trust proxy"')), {
    pool,console:{error:(...args)=>messages.push(args)}
  });
  assert.doesNotThrow(()=>handlers.error(Object.assign(Error('secret connection string'),{code:'ECONNRESET'})));
  assert.equal(messages[0][1].code,'ECONNRESET');
  assert.ok(!JSON.stringify(messages).includes('secret'));
});
