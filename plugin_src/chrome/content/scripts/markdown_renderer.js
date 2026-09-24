// Small, safe Markdown subset shared by reader chat and Zotero notes.
var MarkdownRenderer = {
  escape(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  },

  inline(value) {
    let html = this.escape(value);
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
    return html;
  },

  toHTML(markdown) {
    const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let list = null;
    let inCode = false;
    const closeList = () => {
      if (list) out.push(`</${list}>`);
      list = null;
    };
    const cells = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "")
      .split("|").map((cell) => cell.trim());
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (/^\s*```/.test(line)) {
        closeList();
        out.push(inCode ? "</code></pre>" : "<pre><code>");
        inCode = !inCode;
        continue;
      }
      if (inCode) {
        out.push(this.escape(line) + "\n");
        continue;
      }
      if (!line.trim()) {
        closeList();
        continue;
      }
      const header = line.trim().startsWith("|") ? cells(line) : null;
      const separator = lines[index + 1] && lines[index + 1].trim().startsWith("|")
        ? cells(lines[index + 1]) : null;
      if (header && separator && header.length === separator.length &&
          separator.every((cell) => /^:?-{3,}:?$/.test(cell))) {
        closeList();
        out.push("<table><thead><tr>" + header.map((cell) => `<th>${this.inline(cell)}</th>`).join("") + "</tr></thead><tbody>");
        index += 1;
        while (index + 1 < lines.length && lines[index + 1].trim().startsWith("|")) {
          index += 1;
          const row = cells(lines[index]);
          out.push("<tr>" + header.map((_cell, column) => `<td>${this.inline(row[column] || "")}</td>`).join("") + "</tr>");
        }
        out.push("</tbody></table>");
        continue;
      }
      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        closeList();
        const level = heading[1].length;
        out.push(`<h${level}>${this.inline(heading[2])}</h${level}>`);
        continue;
      }
      const bullet = line.match(/^\s*[-*]\s+(.+)$/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (bullet || numbered) {
        const type = bullet ? "ul" : "ol";
        if (list !== type) {
          closeList();
          out.push(`<${type}>`);
          list = type;
        }
        out.push(`<li>${this.inline((bullet || numbered)[1])}</li>`);
        continue;
      }
      closeList();
      const quote = line.match(/^>\s*(.*)$/);
      if (quote) out.push(`<blockquote>${this.inline(quote[1])}</blockquote>`);
      else if (/^---+$/.test(line.trim())) out.push("<hr/>");
      else out.push(`<p>${this.inline(line)}</p>`);
    }
    closeList();
    if (inCode) out.push("</code></pre>");
    return out.join("");
  },

  render(container, markdown) {
    container.innerHTML = this.toHTML(markdown);
  }
};
