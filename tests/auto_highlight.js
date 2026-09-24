const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ Intl, console });
vm.runInContext(fs.readFileSync('plugin_src/chrome/content/scripts/auto_highlight.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('plugin_src/chrome/content/scripts/error_utils.js', 'utf8'), context);
const api = context.AutoHighlight;

function page(text) {
  return { viewBox: [0, 0, 600, 800], chars: [...text].map((c, i) => ({
    c, rect: [20 + (i % 70) * 7, 760 - Math.floor(i / 70) * 14, 27 + (i % 70) * 7, 770 - Math.floor(i / 70) * 14],
    lineBreakAfter: i % 70 === 69
  })) };
}
const paper = [page('The treatment reduced mortality by 35 percent. The pathway activates downstream receptors. '),
  page(('This ordinary background sentence is not selected for highlighting. ').repeat(30))];
const source = api.indexPages(paper);
const candidate = (id, category = '结论', end = id) => ({ start: id, end, quote: source.text.slice(source.sentences[id].start, source.sentences[end].end), category, score: 95 });
const first = candidate(0);
assert.equal(api.select(source, [first]).length, 1);
assert.equal(api.select(source, [{ ...first, quote: 'The treatment reduced mortality by 99 percent.' }]).length, 0);
assert.equal(api.select(source, [{ ...first, category: '__proto__' }]).length, 0);
assert.equal(api.select(source, [candidate(0, '方法', 3)]).length, 0);
assert.equal(api.select(source, [first, { ...first, category: '方法' }]).length, 1);
const selected = api.select(source, [first])[0];
assert.equal(selected.color, '#ffd400');
assert.equal(selected.text, first.quote);
assert.ok(selected.position.rects.every(api.rectOK));
assert.equal(api.select(source, [first], [{ text: first.quote, position: selected.position }]).length, 0);
assert.equal(api.select(source, [first], [{ text: 'User annotation with a different text.', position: selected.position }]).length, 0);
assert.equal(api.select(source, [first], [{ text: 'x'.repeat(source.total), ours: true }]).length, 0);
const many = source.sentences.map(s => candidate(s.id));
const limited = api.select(source, many);
assert.ok(limited.reduce((n, h) => n + h.weight, 0) <= Math.floor(source.total * .15));
assert.ok(limited.length < many.length);

const cross = api.indexPages([page('The experiment demonstrates'), page(' a major decrease in mortality. ' + 'Background context. '.repeat(40))]);
const crossQuote = cross.sentences[0];
const crossResult = api.select(cross, [{ start: 0, end: 0, quote: crossQuote.text, category: '机制' }]);
assert.equal(crossResult.length, 1);
assert.ok(crossResult[0].position.nextPageRects.length);
assert.equal(crossResult[0].color, '#2ea8e5');
const bad = api.indexPages([{ ...paper[0], chars: paper[0].chars.map(c => ({ ...c, rect: null })) }, paper[1]]);
assert.equal(api.select(bad, [first]).length, 0);
assert.equal(api.indexPages([{ chars: [], viewBox: [0, 0, 100, 100] }]).sentences.length, 0);
const wordSpace = api.indexPages([{ chars: [{ c: 'Study', spaceAfter: true }, { c: 'shows', spaceAfter: true }, { c: 'improved results.' }] }]);
assert.equal(wordSpace.sentences[0].text, 'Study shows improved results.');

async function integration() {
  let saved = [], requests = 0, failSave = false, failAt = 0, transactionActive = false, transactions = 0, nested = 0, response = JSON.stringify([first]);
  const attachment = { id: 8, libraryID: 1, getAnnotations: () => saved.map(h => ({
    annotationType: h.type, annotationText: h.text, annotationPosition: JSON.stringify(h.position), getTags: () => h.tags.map(t => ({ tag: t.name }))
  })) };
  context.ZoteroAdapter = { getPdfAttachment: async () => ({ attachmentItem: attachment, filePath: 'fixture.pdf' }) };
  context.LLMClient = { complete: async () => { requests++; return response; } };
  context.Zotero = {
    Libraries: { get: () => ({ editable: true }) }, DataObjectUtilities: { generateKey: () => 'TESTKEY1' },
    // Match Zotero: saveFromJSON -> saveTx -> executeTransaction always opens
    // a new transaction, which cannot complete while an outer one awaits it.
    Annotations: { saveFromJSON: async () => context.Zotero.DB.executeTransaction(async () => {}) },
    Item: class {
      constructor(type) { assert.equal(type, 'annotation'); }
      setTags(tags) { this.tags = tags; }
      async save(options) {
        assert.equal(transactionActive, true);
        assert.equal(options.tx, undefined);
        assert.equal(options.skipSelect, true);
        assert.equal(this.libraryID, 1);
        assert.equal(this.parentID, 8);
        assert.equal(this.annotationIsExternal, false);
        saved.push({ type: this.annotationType, text: this.annotationText,
          comment: this.annotationComment, color: this.annotationColor,
          position: JSON.parse(this.annotationPosition), pageLabel: this.annotationPageLabel,
          sortIndex: this.annotationSortIndex, tags: this.tags.map(t => ({ name: t.tag })) });
        if (failSave || (failAt && saved.length === failAt)) throw new Error('disk error');
      }
      async saveTx() { return context.Zotero.DB.executeTransaction(() => this.save({ tx: true })); }
    },
    DB: {
      requireTransaction() { assert.equal(transactionActive, true); },
      executeTransaction: async fn => {
        if (transactionActive) { nested++; throw Object.assign(new Error(''), { name: 'TimeoutError' }); }
        const before = saved.slice(); transactions++; transactionActive = true;
        try { return await fn(); } catch (error) { saved = before; throw error; }
        finally { transactionActive = false; }
      }
    }
  };
  // Reproduce the former first-highlight failure using the old call sequence.
  await assert.rejects(() => context.Zotero.DB.executeTransaction(() => context.Zotero.Annotations.saveFromJSON()), { name: 'TimeoutError' });
  assert.equal(nested, 1);
  transactions = 0; nested = 0;
  api.readPDF = async () => paper;
  const result = await api.run({}, {});
  assert.equal(result.count, 1);
  assert.equal(saved[0].text, first.quote);
  assert.equal(saved[0].comment, '【结论】');
  assert.equal(transactions, 1);
  assert.equal(nested, 0);
  assert.deepEqual(saved[0].position, JSON.parse(JSON.stringify(selected.position)));
  assert.equal((await api.run({}, {})).count, 0);
  assert.equal(saved.length, 1);
  response = 'not JSON';
  await assert.rejects(() => api.run({}, {}), /未返回有效/);
  assert.equal(saved.length, 1);
  assert.equal(api.running.size, 0);
  response = JSON.stringify([{ ...first, quote: 'fabrication' }]);
  assert.equal((await api.run({}, {})).count, 0);
  saved = []; response = JSON.stringify([first]); failSave = true;
  await assert.rejects(() => api.run({}, {}), /disk error/);
  assert.equal(saved.length, 0);
  assert.equal(api.running.size, 0);
  // A later write failure must roll back earlier inserts in the same batch.
  failSave = false; failAt = 2; response = JSON.stringify([first, candidate(1, '机制')]);
  await assert.rejects(() => api.run({}, {}), /disk error/);
  assert.equal(saved.length, 0);
  assert.equal(nested, 0);
  failAt = 0;
  assert.equal((await api.run({}, {})).count, 2);
  assert.equal(saved.length, 2);
  assert.equal((await api.run({}, {})).count, 0);
  assert.equal(saved.length, 2);
  api.running.add(8);
  await assert.rejects(() => api.run({}, {}), /正在运行/);
  api.running.clear();
  context.Zotero.Libraries.get = () => ({ editable: false });
  const before = requests;
  await assert.rejects(() => api.run({}, {}), /只读/);
  assert.equal(requests, before);
  console.log('auto highlight validation and transaction tests passed');
}
async function readerBridge() {
  const iframeScope = vm.createContext({});
  const iframePrototype = vm.runInContext('Object.prototype', iframeScope);
  const pdfWindow = {};
  let cloned = 0, called = 0;
  const pdf = {
    numPages: 2,
    getPageLabels: async () => ['i', '1'],
    getPageData: async request => {
      // Model the PDF Worker boundary: reject plugin-scope objects.
      if (Object.getPrototypeOf(request) !== iframePrototype) throw new Error('The object could not be cloned.');
      assert.equal(request.pageIndex, called++);
      return paper[request.pageIndex];
    }
  };
  pdfWindow.PDFViewerApplication = { pdfDocument: pdf };
  context.Components = { utils: { cloneInto(value, scope) {
    assert.equal(scope, pdfWindow);
    cloned++;
    iframeScope.serialized = JSON.stringify(value);
    return vm.runInContext('JSON.parse(serialized)', iframeScope);
  } } };
  context.Zotero = { Reader: { open: async () => ({
    _initPromise: Promise.resolve(),
    _internalReader: { _primaryView: { initializedPromise: Promise.resolve(), _iframeWindow: pdfWindow } }
  }) } };
  await assert.rejects(() => pdf.getPageData({ pageIndex: 0 }), /could not be cloned/);
  const pages = await api.readPDF({ id: 8 }, () => {});
  assert.equal(cloned, 2);
  assert.equal(called, 2);
  assert.equal(pages[0].label, 'i');
  assert.equal(pages[1].label, '1');
  assert.equal(pages[0].chars[0].c, paper[0].chars[0].c);
  assert.notEqual(pages[0].chars, paper[0].chars);
  assert.equal(Object.getPrototypeOf(pages[0].chars), vm.runInContext('Array.prototype', context));
  pdf.getPageLabels = async () => { throw new Error(''); };
  called = 0;
  const noLabels = await api.readPDF({ id: 8 }, () => {});
  assert.equal(noLabels.length, 2);
  assert.equal(noLabels[0].label, undefined);
  pdf.getPageData = async () => { throw new Error('worker unavailable'); };
  await assert.rejects(() => api.readPDF({ id: 8 }, () => {}), /第 1 页文字坐标失败：worker unavailable/);
  console.log('reader cross-compartment regression tests passed');
}
(async () => { await readerBridge(); await integration(); })().catch(error => { console.error(error); process.exitCode = 1; });
