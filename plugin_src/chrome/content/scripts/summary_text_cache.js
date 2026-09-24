// input: PDF attachment info, configuration parameters, extract worker function
// output: Extracted clean text string with caching metadata
// pos: In-memory session cache for PDF extracted text preventing duplicate extraction across tasks

// Bounded session cache for summary/table PDF extraction, separate from library chat.
var SummaryTextCache = {
  entries: new Map(), pending: new Map(), maxChars: 6000000, maxEntries: 8,
  fingerprint(info, config) {
    try {
      if (!info.filePath) return null;
      const file = Zotero.File.pathToFile(info.filePath);
      if (!file.exists()) return null;
      return JSON.stringify([info.attachmentItem.libraryID, info.attachmentItem.key || info.attachmentItem.id,
        file.path, file.lastModifiedTime, file.fileSize, config.mineruMode, config.mineruModel]);
    } catch (_) { return null; }
  },
  clear() { this.entries.clear(); this.pending.clear(); },
  async get(info, config, extract, report = () => {}) {
    const key = this.fingerprint(info, config);
    if (key && this.entries.has(key)) {
      const text = this.entries.get(key); this.entries.delete(key); this.entries.set(key, text);
      report('已复用本次会话中提取的 PDF 正文。'); return { text, cached: true };
    }
    if (key && this.pending.has(key)) {
      report('正在等待同一 PDF 的正文提取完成…');
      try {
        const text = await Promise.race([
          this.pending.get(key),
          new Promise((_, reject) => setTimeout(() => reject(new Error('等待已有提取任务超时')), 60000))
        ]);
        return { text, cached: true };
      } catch (_e) {
        this.pending.delete(key);
      }
    }
    const work = (async () => {
      const text = await extract();
      if (!String(text || '').trim()) throw new Error('PDF 中未提取到可用于总结的文字。');
      if (key && this.fingerprint(info, config) === key && text.length <= this.maxChars) {
        this.entries.set(key, text);
        let size = [...this.entries.values()].reduce((n, value) => n + value.length, 0);
        while (this.entries.size > this.maxEntries || size > this.maxChars) {
          const oldest = this.entries.keys().next().value; size -= this.entries.get(oldest).length; this.entries.delete(oldest);
        }
      }
      return text;
    })();
    if (key) this.pending.set(key, work);
    try { return { text: await work, cached: false }; }
    finally { if (key && this.pending.get(key) === work) this.pending.delete(key); }
  }
};
