// Local metadata/annotation index. This module never opens attachments or full text.
var SILibraryIndex = {
  version: 2, libraries: new Map(), dirty: new Map(), dirtySeq: 0, observer: null, syncing: null,
  init() {
    if (this.observer !== null) return;
    this.observer = Zotero.Notifier.registerObserver({ notify: (_event, type, ids) => {
      if (type === 'item') for (const id of ids) this.dirty.set(Number(id), ++this.dirtySeq);
    } }, ['item'], 'si-library-index');
  },
  destroy() {
    if (this.observer !== null) Zotero.Notifier.unregisterObserver(this.observer);
    this.observer = null;
  },
  plain(html) {
    // Zotero's main document is XUL/XML. Its innerHTML setter rejects normal
    // HTML notes such as &nbsp; and <br>. Parse in an inert HTML document instead.
    const doc = Zotero.getMainWindow().document.implementation.createHTMLDocument('');
    const template = doc.createElementNS('http://www.w3.org/1999/xhtml', 'template');
    template.innerHTML = String(html || '');
    const content = template.content;
    for (const node of content.querySelectorAll('script,style')) node.remove();
    for (const node of content.querySelectorAll('p,div,li,br,h1,h2,h3,h4,tr')) node.append(doc.createTextNode('\n'));
    return content.textContent.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  },
  chunks(text, size = 1800) {
    const result = [];
    for (let start = 0; start < text.length;) {
      let end = Math.min(start + size, text.length);
      if (end < text.length) {
        const cut = Math.max(text.lastIndexOf('\n', end), text.lastIndexOf('。', end), text.lastIndexOf('. ', end));
        if (cut > start + size / 2) end = cut + 1;
      }
      result.push(text.slice(start, end)); start = end;
    }
    return result;
  },
  path(libraryID) { const file = Zotero.File.pathToFile(Zotero.DataDirectory.dir); file.append(`si-library-index-${libraryID}.json`); return file.path; },
  async readCache(libraryID) {
    if (this.libraries.has(libraryID)) return this.libraries.get(libraryID);
    let cache = { version: this.version, records: {} };
    try {
      const stored = JSON.parse(await Zotero.File.getContentsAsync(this.path(libraryID)));
      if (stored.version === this.version && stored.records && !Array.isArray(stored.records)
        && Object.values(stored.records).every(r => typeof r.stamp === 'string' && Array.isArray(r.collections) && Array.isArray(r.tags)
          && Array.isArray(r.sources) && r.sources.every(s => typeof s.text === 'string' && typeof s.uid === 'string'))) cache = stored;
    } catch (_) { /* Missing or damaged cache is rebuilt from Zotero records. */ }
    this.libraries.set(libraryID, cache); return cache;
  },
  async sync(libraryID, report = () => {}, stopped = () => false) {
    const previous = this.syncing || Promise.resolve();
    const work = previous.catch(() => {}).then(() => this.scan(libraryID, report, stopped));
    this.syncing = work;
    try { return await work; } finally { if (this.syncing === work) this.syncing = null; }
  },
  async scan(libraryID, report, stopped) {
    const library = Zotero.Libraries.get(libraryID);
    if (!library || library.libraryType === 'feed') throw new Error('请选择个人图书馆或群组库。');
    await library.waitForDataLoad('item');
    await library.waitForDataLoad('collection');
    const cache = await this.readCache(libraryID);
    const items = (await Zotero.Items.getAll(libraryID, false, false)).filter(item => !item.deleted);
    const byID = new Map(items.map(item => [item.id, item]));
    const rootOf = item => {
      const visited = new Set();
      while (item?.parentID && !visited.has(item.id)) { visited.add(item.id); item = byID.get(item.parentID); }
      return item;
    };
    const groups = new Map();
    for (const item of items) {
      const root = rootOf(item);
      if (!root || (!root.isRegularItem() && !root.isNote() && !(root.isAttachment() && root.attachmentContentType === 'application/pdf'))) continue;
      if (!groups.has(root.id)) groups.set(root.id, []);
      groups.get(root.id).push(item);
    }
    const records = {}, dirtySnapshot = new Map(this.dirty);
    let updated = 0, index = 0;
    for (const [rootID, children] of groups) {
      if (stopped()) throw new Error('已停止索引，原索引保持可用。');
      const root = byID.get(rootID);
      const stamp = JSON.stringify(children.map(item => [item.id, item.key, item.parentID, item.version, item.clientVersion, item.getField('dateModified'), item.getCollections?.() || []]));
      const previous = cache.records[root.key];
      if (previous?.stamp === stamp && !children.some(item => dirtySnapshot.has(item.id))) records[root.key] = previous;
      else {
        for (const item of children) {
          if (stopped()) throw new Error('已停止索引。');
          if (item.isNote()) await item.loadDataType('note');
          if (item.isAnnotation()) await item.loadDataType('annotationDeferred');
        }
        try { records[root.key] = this.record(root, children, stamp); }
        catch (error) { throw new Error(`整理条目 ${root.key} 的元数据、笔记或注释失败：${SIError.describe(error)}`); }
        updated++;
      }
      if (++index % 40 === 0) { report(`整理本地资料 ${index} / ${groups.size}…`); await Zotero.Promise.delay(0); }
    }
    if (stopped()) throw new Error('已停止索引。');
    const next = { version: this.version, records, updatedAt: Date.now() };
    if (updated || Object.keys(cache.records).length !== Object.keys(records).length || !cache.updatedAt) {
      await Zotero.File.putContentsAsync(this.path(libraryID), JSON.stringify(next));
    }
    this.libraries.set(libraryID, next);
    const indexedIDs = new Set([...byID.keys(), ...Object.values(cache.records).flatMap(r => r.childIDs || [])]);
    for (const [id, revision] of dirtySnapshot) if (indexedIDs.has(id) && this.dirty.get(id) === revision) this.dirty.delete(id);
    report(`本地索引已更新：${groups.size} 个条目，本次更新 ${updated} 个。`);
    return next;
  },
  record(root, children, stamp) {
    const field = name => String(root.getField(name) || '');
    const regular = root.isRegularItem();
    const title = root.isNote() ? (root.getNoteTitle() || '独立笔记') : (field('title') || root.attachmentFilename || '未命名文献');
    const record = { stamp, childIDs: children.map(i => i.id), id: root.id, key: root.key, libraryID: root.libraryID, title,
      year: regular ? (field('date').match(/\b\d{4}\b/) || [''])[0] : '',
      collections: root.getCollections(), regular, sources: [],
      authors: regular ? root.getCreators().map(c => [c.firstName, c.lastName].filter(Boolean).join(' ')).join('; ') : '',
      tags: root.getTags().map(t => t.tag) };
    const push = (item, kind, text, extra = {}) => {
      this.chunks(String(text || '').trim()).forEach((text, part) => record.sources.push({
        uid: `${root.libraryID}/${root.key}/${item.key}/${kind}/${part}`, itemID: root.id,
        libraryID: root.libraryID, itemKey: root.key, sourceID: item.id, sourceKey: item.key,
        title, year: record.year, authors: record.authors, kind, text, ...extra
      }));
    };
    if (!root.isNote()) {
      push(root, 'metadata', `标题：${title}\n作者：${record.authors}\n年份：${record.year}\n期刊：${field('publicationTitle')}\nDOI：${field('DOI')}\n标签：${record.tags.join('、')}`);
      push(root, 'abstract', field('abstractNote'));
    }
    for (const item of children) {
      if (item.isNote()) {
        const text = this.plain(item.getNote());
        const ai = item.getTags().some(t => t.tag === 'SI AI') || /^(未完成 · )?(AI |AI阅读|文献总结|表格总结|SI 文献库)/.test(item.getNoteTitle?.() || '');
        push(item, ai ? 'aiNote' : 'note', text);
      } else if (item.isAnnotation()) {
        const tags = item.getTags().map(t => t.tag);
        const ours = tags.includes('SI 自动高亮');
        const category = ours ? ({ '#ffd400': '结论', '#2ea8e5': '机制', '#5fb236': '方法', '#ff6666': '空白', '#a28ae5': '可引用' }[String(item.annotationColor).toLowerCase()] || '') : '';
        const extra = { attachmentID: item.parentID, annotationKey: item.key, page: item.annotationPageLabel || '', category, color: item.annotationColor || '' };
        push(item, 'annotation', item.annotationText, extra);
        push(item, ours ? 'aiComment' : 'comment', item.annotationComment, extra);
      }
    }
    return record;
  },
  options() {
    return Zotero.Libraries.getAll().filter(lib => ['user', 'group'].includes(lib.libraryType)).map(lib => ({
      id: lib.libraryID, name: lib.name,
      collections: Zotero.Collections.getByLibrary(lib.libraryID, true).map(c => ({ id: c.id, name: c.name, parentID: c.parentID || null }))
    }));
  },
  scope(cache, options) {
    let records = Object.values(cache.records);
    let collectionAudit = [];
    if (options.mode === 'selected') {
      const ids = new Set(options.itemIDs || []);
      records = records.filter(r => ids.has(r.id));
    } else if (options.mode === 'collection') {
      const collection = Zotero.Collections.get(Number(options.collectionID));
      if (!collection || collection.libraryID !== Number(options.libraryID)) throw new Error('所选分类已删除或不属于当前图书馆。');
      const ids = new Set([Number(collection.id)]);
      if (options.recursive) {
        for (const c of collection.getDescendents(false, 'collection', false)) ids.add(Number(c.id));
      }
      const memberIDs = new Set();
      collectionAudit = [...ids].map(id => {
        const c = Zotero.Collections.get(id);
        if (!c || c.deleted || c.libraryID !== Number(options.libraryID)) return null;
        const members = new Set(c.getChildItems(true, false).map(Number));
        for (const member of members) memberIDs.add(member);
        return { id, name: c.name, members: [...members], indexed: records.filter(r => members.has(Number(r.id))).length };
      }).filter(Boolean);
      // Use live Zotero memberships: collection moves need not modify item dates.
      records = records.filter(r => memberIDs.has(Number(r.id)));
    }
    const indexedBeforeFilters = records.length;
    const from = Number(options.from) || 0, to = Number(options.to) || 9999;
    if (from > to) throw new Error('起始年份不能晚于结束年份。');
    if (options.from || options.to) records = records.filter(r => r.year && Number(r.year) >= from && Number(r.year) <= to);
    if (options.tag) records = records.filter(r => r.tags.some(t => t.toLowerCase().includes(options.tag.toLowerCase())));
    const allowed = new Set(['metadata', ...(options.abstract ? ['abstract'] : []), ...(options.annotations ? ['annotation','comment','aiComment'] : []), ...(options.notes ? ['note'] : []), ...(options.aiNotes ? ['aiNote'] : [])]);
    if (options.category) records = records.filter(r => r.sources.some(s => allowed.has(s.kind) && s.category === options.category));
    const sources = records.flatMap(r => r.sources.filter(s => allowed.has(s.kind) && (!options.category || s.category === options.category)));
    const filteredIDs = new Set(records.map(r => Number(r.id)));
    const audit = collectionAudit.map(c => ({ id: c.id, name: c.name, total: c.members.length, indexed: c.indexed, afterFilters: c.members.filter(id => filteredIDs.has(id)).length }));
    const stats = { indexedBeforeFilters, collectionAudit: audit, items: records.length, papers: records.filter(r => r.regular).length,
      abstracts: records.filter(r => r.sources.some(s => s.kind === 'abstract')).length,
      annotated: records.filter(r => r.sources.some(s => s.kind === 'annotation' || s.kind === 'comment')).length,
      sources: sources.length, evidenceItems: new Set(sources.filter(s => s.kind !== 'metadata').map(s => s.itemID)).size };
    return { records, sources, stats };
  }
};
