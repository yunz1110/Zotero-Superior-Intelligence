const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ AbortController, setTimeout, clearTimeout, Zotero: { debug() {}, logError() {} } });
for (const file of ['error_utils.js', 'auto_highlight.js', 'main.js', 'llm_client.js']) {
  vm.runInContext(fs.readFileSync(`plugin_src/chrome/content/scripts/${file}`, 'utf8'), context);
}
const describe = context.SIError.describe;
assert.equal(describe(new Error('')), '底层组件未提供错误详情');
assert.equal(describe(null), '底层组件未提供错误详情');
assert.equal(describe('connection closed'), 'connection closed');
assert.match(describe({ name: 'AbortError', message: '', code: 20 }), /AbortError.*code=20/);
assert.match(describe({ result: 2147500037 }), /result=2147500037/);
const inaccessible = new Proxy({}, { get() { throw new Error('Access denied'); } });
assert.equal(describe(inaccessible), '底层组件未提供错误详情');
const circular = { message: '', cause: null }; circular.cause = circular;
assert.equal(describe(circular), '底层组件未提供错误详情');
assert.doesNotMatch(describe(new Error('Authorization Bearer secret sk-test123')), /secret|sk-test123/);

(async () => {
  // Exercise the actual bootstrap -> serialized response -> dashboard boundary.
  const api = context.AutoHighlight;
  api._run = async (_item, _config, report) => { report('正在筛选科研原句：第 2 / 3 组…'); throw new Error(''); };
  const response = JSON.parse(await context.ZoteroMinerUAI.highlightItem({}, () => {}, {}));
  assert.equal(response.ok, false);
  assert.match(response.error, /失败阶段：正在筛选科研原句：第 2 \/ 3 组/);
  assert.match(response.error, /底层组件未提供错误详情/);
  api._run = async () => ({ count: 0, highlights: [] });
  assert.equal(JSON.parse(await context.ZoteroMinerUAI.highlightItem({}, () => {}, {})).ok, true);
  context.fetch = async () => { throw { name: 'NetworkError', message: '' }; };
  await assert.rejects(() => context.LLMClient.complete([], { llmApiBase: 'http://localhost:1234', llmModel: 'fixture' }), /模型网络请求未完成：NetworkError/);
  console.log('empty/native error and cross-window response tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
