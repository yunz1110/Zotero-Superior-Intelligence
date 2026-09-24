// input: PDF reader attachment object, user reading questions, prompt templates
// output: In-reader conversation history, context-aware answers, editable notes
// pos: Interactive reading and Q&A assistant embedded in Zotero 10 PDF reader pane

// PDF reader right pane chat, scoped to the attachment opened in each tab.
var ReaderChat = {
  pluginID: "zotero-mineru-ai@custom.org",
  paneID: null,
  toolbarHandler: null,
  sessions: new Map(),
  textCache: new Map(),

  register() {
    Zotero.ftl.addResourceIds(["mineru.ftl"]);
    this.paneID = Zotero.ItemPaneManager.registerSection({
      paneID: "mineru-ai-chat",
      pluginID: this.pluginID,
      header: {
        l10nID: "mineru-reader-chat",
        icon: "chrome://zoteromineru/content/icons/favicon@0.5x.png"
      },
      sidenav: {
        l10nID: "mineru-reader-chat",
        icon: "chrome://zoteromineru/content/icons/favicon@0.5x.png"
      },
      onItemChange: ({ tabType, setEnabled }) => {
        setEnabled(tabType === "reader");
      },
      onRender: ({ doc, body }) => this.render(doc, body)
    });
    if (!this.paneID) throw new Error("无法注册 PDF 阅读器 AI 侧边栏");
    this.toolbarHandler = ({ reader, doc, append }) => {
      const button = doc.createElement("button");
      button.type = "button";
      button.textContent = "SI 对话";
      button.title = "打开当前 PDF 的 SI 对话侧边栏";
      button.style.cssText = "padding:4px 9px;margin:0 5px;border:1px solid var(--material-border,#aaa);border-radius:5px;cursor:pointer;background:var(--material-button,#f7f7f7);color:var(--fill-primary,#222)";
      button.addEventListener("click", () => this.openPane(reader));
      append(button);
    };
    Zotero.Reader.registerEventListener("renderToolbar", this.toolbarHandler, this.pluginID);
  },

  unregister() {
    if (this.toolbarHandler) {
      Zotero.Reader.unregisterEventListener("renderToolbar", this.toolbarHandler);
      this.toolbarHandler = null;
    }
    if (this.paneID) {
      Zotero.ItemPaneManager.unregisterSection(this.paneID);
      this.paneID = null;
    }
    Zotero.ftl.removeResourceIds(["mineru.ftl"]);
    this.sessions.clear();
    this.textCache.clear();
  },

  openPane(reader) {
    const win = Zotero.getMainWindow();
    const pane = win?.document.getElementById("zotero-context-pane");
    if (!pane) return;
    pane.collapsed = false;
    pane.mode = "item";
    const details = win.document.querySelector(`item-details[data-tab-id="${reader.tabID}"]`);
    details?.render();
    details?.scrollToPane(this.paneID, "smooth");
  },

  attachmentForBody(body) {
    const tabID = body.closest("item-details")?.dataset.tabId;
    const reader = tabID && Zotero.Reader.getByTabID(tabID);
    if (!reader?.itemID) return null;
    const item = Zotero.Items.get(reader.itemID);
    if (!item) return null;
    if (item.isAttachment?.() && item.attachmentContentType === "application/pdf") return item;
    if (typeof item.isPDFAttachment === "function" && item.isPDFAttachment()) return item;
    if (item.isRegularItem?.()) {
      for (const id of item.getAttachments?.() || []) {
        const att = Zotero.Items.get(id);
        if (att?.isAttachment?.() && att.attachmentContentType === "application/pdf") return att;
      }
    }
    return null;
  },

  session(itemID) {
    if (!this.sessions.has(itemID)) this.sessions.set(itemID, { history: [], busy: false, noteID: null });
    return this.sessions.get(itemID);
  },

  render(doc, body) {
    body.replaceChildren();
    const attachment = this.attachmentForBody(body);
    if (!attachment) return;
    const state = this.session(attachment.id);
    const el = (tag, className, label) => {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (label) node.textContent = label;
      return node;
    };
    const style = el("style");
    style.textContent = `
      .mineru-chat { display:flex; flex-direction:column; gap:12px; min-height:430px; padding:12px; color:#243247; background:#fff; color-scheme:light; --material-border:#dce4ed; font:13px system-ui,sans-serif; }
      .mineru-chat-toolbar { display:flex; gap:6px; flex-wrap:wrap; }
      .mineru-chat button { cursor:pointer; border:1px solid var(--material-border,#bbb); border-radius:7px; min-height:32px; padding:6px 9px; background:#fff; color:inherit; }
      .mineru-chat button:disabled { opacity:.5; cursor:default; }
      .mineru-chat-log { min-height:220px; max-height:420px; overflow:auto; display:flex; flex-direction:column; gap:12px; padding:4px 0; }
      .mineru-chat-message { padding:12px; white-space:pre-wrap; overflow-wrap:anywhere; border:1px solid #e4eaf1; border-radius:9px; background:#f8fafc; line-height:1.75; }
      .mineru-chat-message.user { background:#eff5fc; border-color:#dbe7f6; margin-left:18px; }
      .mineru-chat-message.assistant { white-space:normal; }
      .mineru-chat-message.assistant p { margin:5px 0; }
      .mineru-chat-message.assistant h1, .mineru-chat-message.assistant h2, .mineru-chat-message.assistant h3 { font-size:1em; margin:9px 0 4px; }
      .mineru-chat-message.assistant ul, .mineru-chat-message.assistant ol { margin:5px 0; padding-left:20px; }
      .mineru-chat-message.assistant li { margin:3px 0; }
      .mineru-chat-message.assistant pre { overflow:auto; white-space:pre; }
      .mineru-chat-message.assistant table { border-collapse:collapse; width:100%; display:block; overflow-x:auto; }
      .mineru-chat-message.assistant th, .mineru-chat-message.assistant td { border:1px solid var(--material-border,#bbb); padding:4px; }
      .mineru-chat textarea { width:100%; min-height:88px; box-sizing:border-box; resize:vertical; font:inherit; padding:7px; border:1px solid var(--material-border,#aaa); border-radius:5px; background:#fff; color:inherit; }
      .mineru-chat select { width:100%; padding:5px; border:1px solid var(--material-border,#aaa); border-radius:5px; background:#fff; color:inherit; }
      .mineru-chat-status { min-height:18px; color:#627086; font-size:11px; line-height:1.6; }
      .mineru-chat-intro { color:#627086; font-size:12px; line-height:1.65; }
      .mineru-chat-heading { font-size:16px; font-weight:650; letter-spacing:-.02em; margin:0; }
      .mineru-chat button:hover { background:#f0f5fb; border-color:#9bb2d1; }
      .mineru-chat .mineru-chat-send { color:#fff; background:#315f9f; border-color:#315f9f; font-weight:600; }
      .mineru-chat .mineru-chat-send:hover { background:#254c83; }
      .mineru-chat :is(button, select, textarea):focus-visible { outline:2px solid #3979ce; outline-offset:2px; }
      .mineru-chat-log:empty::before { content:"从一个研究问题开始\\A选择上方快捷提问，或输入你想深入了解的内容。"; white-space:pre-line; text-align:center; color:#627086; font-size:12px; line-height:1.9; margin:auto 0; padding:28px 14px; border:1px dashed #dce4ed; border-radius:9px; }
      .mineru-chat-msg-actions { display:flex; gap:6px; margin-top:8px; padding-top:6px; border-top:1px dashed #dce4ed; font-size:11px; }
      .mineru-chat-msg-btn { cursor:pointer; padding:3px 8px; border:1px solid #d0dbe7; border-radius:5px; background:#fff; color:#315f9f; font-size:11px; line-height:1.4; }
      .mineru-chat-msg-btn:hover { background:#f0f5fb; border-color:#9bb2d1; }
      .mineru-chat-btn-save { background:#315f9f !important; color:#fff !important; border-color:#315f9f !important; font-weight:600; }
      .mineru-chat-edit-wrap { margin-top:6px; display:flex; flex-direction:column; gap:6px; }
      .mineru-chat-edit-box { width:100%; min-height:130px; box-sizing:border-box; font:inherit; font-family:ui-monospace,Menlo,Consolas,monospace; font-size:12px; line-height:1.6; padding:8px; border:1px solid #3979ce; border-radius:6px; background:#fff; color:#222; resize:vertical; }
    `;
    const root = el("div", "mineru-chat");
    const heading = el("h2", "mineru-chat-heading", "文献研读");
    const intro = el("div", "mineru-chat-intro", "基于当前 PDF 提问。发送内容包括相关正文摘录和最近对话。");
    const profileSelect = el("select");
    profileSelect.setAttribute("aria-label", "当前对话模型配置");
    Zotero.MinerUAI.getProfiles().forEach((profile, index) => {
      const option = el("option", "", `${profile.name || `配置 ${index + 1}`} · ${profile.model || "未填写模型"}`);
      option.value = String(index + 1);
      profileSelect.append(option);
    });
    profileSelect.value = String(Zotero.MinerUAI.activeProfile());
    profileSelect.addEventListener("change", () => {
      Zotero.MinerUAI.setActiveProfile(Number(profileSelect.value));
      status.textContent = `已切换到模型配置 ${profileSelect.value}。`;
    });
    const promptBar = el("div", "mineru-chat-toolbar");
    const log = el("div", "mineru-chat-log");
    const input = el("textarea");
    input.setAttribute("aria-label", "向当前文献提问");
    input.placeholder = "询问研究问题、方法、结果，或输入自己的问题…";
    const actions = el("div", "mineru-chat-toolbar");
    const send = el("button", "mineru-chat-send", "发送问题");
    const save = el("button", "", "保存对话到文献笔记");
    save.disabled = !state.history.length || state.busy;
    const clear = el("button", "", "清空对话");
    const settings = el("button", "", "模型设置");
    const status = el("div", "mineru-chat-status");
    const copyText = async (text, btn) => {
      let ok = false;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          ok = true;
        }
      } catch (_) {}
      if (!ok) {
        try {
          const helper = Cc["@mozilla.org/widget/clipboardhelper;1"]?.getService(Ci.nsIClipboardHelper);
          if (helper) { helper.copyString(text); ok = true; }
        } catch (_) {}
      }
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = ok ? "✓ 已复制" : "复制失败";
        setTimeout(() => { btn.textContent = orig; }, 1600);
      }
    };
    const addMessage = (role, initialContent, messageObj = null) => {
      const node = el("div", `mineru-chat-message ${role}`);
      let currentContent = initialContent;
      const bodyNode = el("div", "mineru-chat-body");
      if (role === "assistant") MarkdownRenderer.render(bodyNode, currentContent);
      else bodyNode.textContent = currentContent;
      node.append(bodyNode);

      if (role === "assistant") {
        const actionsNode = el("div", "mineru-chat-msg-actions");
        const copyBtn = el("button", "mineru-chat-msg-btn", "📋 复制回答");
        copyBtn.title = "复制回答 Markdown 文本到剪贴板";
        copyBtn.addEventListener("click", () => copyText(currentContent, copyBtn));

        const editBtn = el("button", "mineru-chat-msg-btn", "✏️ 编辑修改");
        editBtn.title = "在线修改当前回答，修改后可直接保存至文献笔记";
        let editWrap = null, editBox = null;

        editBtn.addEventListener("click", () => {
          if (editWrap) {
            editWrap.remove();
            editWrap = null;
            bodyNode.style.display = "";
            editBtn.textContent = "✏️ 编辑修改";
            return;
          }
          bodyNode.style.display = "none";
          editBtn.textContent = "✕ 取消编辑";
          editWrap = el("div", "mineru-chat-edit-wrap");
          editBox = el("textarea", "mineru-chat-edit-box");
          editBox.value = currentContent;

          const toolRow = el("div", "mineru-chat-msg-actions");
          const saveEditBtn = el("button", "mineru-chat-msg-btn mineru-chat-btn-save", "✓ 保存修改");
          saveEditBtn.addEventListener("click", () => {
            currentContent = editBox.value;
            MarkdownRenderer.render(bodyNode, currentContent);
            bodyNode.style.display = "";
            if (messageObj) messageObj.content = currentContent;
            editWrap.remove();
            editWrap = null;
            editBtn.textContent = "✏️ 编辑修改";
            status.textContent = "回答已更新。点击下方“保存对话到文献笔记”可同步存盘。";
          });

          const copyCurBtn = el("button", "mineru-chat-msg-btn", "📋 复制编辑框文本");
          copyCurBtn.addEventListener("click", () => copyText(editBox.value, copyCurBtn));

          toolRow.append(saveEditBtn, copyCurBtn);
          editWrap.append(editBox, toolRow);
          node.insertBefore(editWrap, actionsNode);
          editBox.focus();
        });

        actionsNode.append(copyBtn, editBtn);
        node.append(actionsNode);
      }

      log.append(node);
      log.scrollTop = log.scrollHeight;
      return {
        node, bodyNode,
        updateContent: (text) => {
          currentContent = text;
          MarkdownRenderer.render(bodyNode, text);
        },
        attachHistory: (obj) => { messageObj = obj; }
      };
    };
    for (const message of state.history) addMessage(message.role, message.content, message);
    const presets = [
      ["总结论文", "请总结这篇论文的研究问题、主要方法、关键结果和贡献。"],
      ["解释方法", "请详细解释这篇论文的方法、数据来源、实验设计和关键参数。"],
      ["找局限性", "请分析论文中明确提及的局限性，并区分作者陈述与可推断的问题。"],
      ["提炼结论", "请列出论文最重要的定量结果和结论，并保留原文中的数值与单位。"]
    ];
    for (const [label, prompt] of presets) {
      const button = el("button", "", label);
      button.addEventListener("click", () => {
        input.value = prompt;
        input.focus();
      });
      promptBar.append(button);
    }
    const customButton = el("button", "", "自定义提示词");
    const customEditor = el("div");
    customEditor.style.display = "none";
    const customInput = el("textarea");
    customInput.placeholder = "输入常用提问，例如：请按研究目的、方法和局限性分析当前论文。";
    const customSave = el("button", "", "保存并填入提问框");
    const customPromptKey = "extensions.zoteromineru.customPrompt";
    customButton.addEventListener("click", () => {
      customInput.value = Zotero.Prefs.get(customPromptKey, true) || "";
      customEditor.style.display = customEditor.style.display === "none" ? "block" : "none";
      if (customEditor.style.display === "block") customInput.focus();
    });
    customSave.addEventListener("click", () => {
      const prompt = customInput.value.trim();
      if (!prompt) {
        status.textContent = "请先输入自定义提示词。";
        return;
      }
      Zotero.Prefs.set(customPromptKey, prompt, true);
      input.value = prompt;
      customEditor.style.display = "none";
      status.textContent = "自定义提示词已保存，并填入提问框。";
      input.focus();
    });
    promptBar.append(customButton);
    customEditor.append(customInput, customSave);
    const submit = async () => {
      const question = input.value.trim();
      if (!question || state.busy) return;
      state.busy = true;
      send.disabled = true;
      save.disabled = true;
      input.value = "";
      addMessage("user", question);
      const answerHandle = addMessage("assistant", "正在读取 PDF…");
      try {
        const fullText = await this.getPdfText(attachment, (message) => { status.textContent = message; });
        const context = this.selectContext(fullText, question);
        status.textContent = "正在等待模型回答…";
        const answer = await LLMClient.chatWithPdf(
          context,
          [...state.history, { role: "user", content: question }],
          Zotero.MinerUAI.getConfig(),
          (_delta, full) => {
            answerHandle.updateContent(full);
            log.scrollTop = log.scrollHeight;
          }
        );
        const assistantEntry = { role: "assistant", content: answer };
        state.history.push({ role: "user", content: question }, assistantEntry);
        answerHandle.attachHistory(assistantEntry);
        status.textContent = "回答完成";
      } catch (error) {
        answerHandle.updateContent(`出错：${error.message}`);
        status.textContent = "请检查 PDF 正文和模型设置";
        Zotero.logError(error);
      } finally {
        state.busy = false;
        send.disabled = false;
        save.disabled = !state.history.length;
      }
    };
    send.addEventListener("click", submit);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        submit();
      }
    });
    clear.addEventListener("click", () => {
      state.history = [];
      log.replaceChildren();
      status.textContent = "对话已清空";
      save.disabled = true;
    });
    save.addEventListener("click", async () => {
      if (!state.history.length || state.busy) return;
      save.disabled = true;
      status.textContent = "正在保存到 Zotero 笔记…";
      try {
        const note = await ZoteroAdapter.saveConversationNote(attachment, state.history, state.noteID);
        state.noteID = note.id;
        status.textContent = "已保存到当前文献的笔记。继续对话后可再次点击更新。";
      } catch (error) {
        status.textContent = `保存失败：${error.message}`;
        Zotero.logError(error);
      } finally {
        save.disabled = false;
      }
    });
    settings.addEventListener("click", () => Zotero.MinerUAI.openPreferences());
    actions.append(send, save, clear, settings);
    root.append(heading, intro, profileSelect, promptBar, customEditor, log, input, actions, status);
    body.append(style, root);
  },

  async getPdfText(attachment, report) {
    if (this.textCache.has(attachment.id)) return this.textCache.get(attachment.id);
    const task = (async () => {
      report("正在提取 PDF 正文…");
      const config = Zotero.MinerUAI.getConfig();
      const info = await ZoteroAdapter.getPdfAttachment(attachment);
      if (info && typeof SummaryTextCache !== "undefined") {
        try {
          const cached = await SummaryTextCache.get(info, config, async () => {
            let text = (await Zotero.PDFWorker.getFullText(attachment.id, null))?.text || "";
            if (!text.trim() && info.filePath) {
              report("未找到文字层，正在使用 MinerU 解析扫描版 PDF…");
              const bytes = await ZoteroAdapter.readFileBinary(info.filePath);
              const parsed = await MinerUClient.parsePdf(info.fileName, bytes,
                { mode: config.mineruMode, token: config.mineruToken, model: config.mineruModel }, report);
              text = parsed.markdown || "";
            }
            return text;
          }, report);
          if (cached?.text?.trim()) return cached.text;
        } catch (_) {}
      }
      let text = (await Zotero.PDFWorker.getFullText(attachment.id, null))?.text || "";
      if (text.trim()) return text;
      report("未找到可复制文字，正在使用 MinerU 解析扫描版 PDF…");
      if (!info?.filePath) throw new Error("当前 PDF 没有可读取的本地文件。");
      const bytes = await ZoteroAdapter.readFileBinary(info.filePath);
      const parsed = await MinerUClient.parsePdf(info.fileName, bytes,
        { mode: config.mineruMode, token: config.mineruToken, model: config.mineruModel }, report);
      if (!parsed?.markdown?.trim()) throw new Error("PDF 和 MinerU 均未提取到正文。");
      return parsed.markdown;
    })();
    this.textCache.set(attachment.id, task);
    try { return await task; }
    catch (error) { this.textCache.delete(attachment.id); throw error; }
  },

  selectContext(text, question) {
    if (!text) return "";
    // Modern LLMs comfortably handle up to 60k characters. Send full paper if within budget!
    if (text.length <= 60000) return text;

    const chunks = text.match(/[\s\S]{1,1800}/g) || [];
    const qLower = (question || "").toLowerCase();

    // Map Chinese research query concepts to bilingual English terms
    const conceptMap = [
      [/问题|背景|目的|动机|意义/, ['research question', 'objective', 'aim', 'motivation', 'background', 'introduction', 'purpose']],
      [/方法|模型|数据|实验|设计|算法|架构|参数|实现/, ['method', 'methodology', 'data', 'dataset', 'experiment', 'design', 'algorithm', 'model', 'setup', 'parameter', 'architecture']],
      [/结果|结论|发现|性能|指标|评价|精度|分析/, ['result', 'finding', 'conclusion', 'performance', 'evaluation', 'discussion', 'accuracy', 'metric', 'comparison']],
      [/局限|不足|缺陷|未来|挑战/, ['limitation', 'shortcoming', 'drawback', 'future work', 'challenge', 'discussion']]
    ];

    const expandedTerms = new Set();
    for (const term of (qLower.match(/[a-z0-9]{3,}|[\u4e00-\u9fff]{2,}/g) || []).slice(0, 15)) {
      expandedTerms.add(term);
    }
    for (const [pattern, englishList] of conceptMap) {
      if (pattern.test(qLower)) {
        for (const word of englishList) expandedTerms.add(word);
      }
    }

    const termArray = [...expandedTerms];
    const ranked = chunks.map((chunk, index) => {
      const cLower = chunk.toLowerCase();
      const score = termArray.reduce((acc, term) => acc + (cLower.includes(term) ? 1 : 0), 0);
      return { index, chunk, score };
    }).sort((a, b) => b.score - a.score || a.index - b.index);

    // Keep the beginning (Abstract, Introduction, Data)
    const chosen = new Set([0, 1, 2, 3]);
    // Keep the ending (Discussion, Conclusion)
    if (chunks.length > 5) {
      chosen.add(chunks.length - 2);
      chosen.add(chunks.length - 1);
    }

    // Accumulate top relevant chunks up to ~55,000 characters
    let currentLength = [...chosen].reduce((acc, idx) => acc + (chunks[idx]?.length || 0), 0);
    for (const entry of ranked) {
      if (chosen.has(entry.index)) continue;
      if (currentLength + entry.chunk.length > 55000 || chosen.size >= 32) break;
      chosen.add(entry.index);
      currentLength += entry.chunk.length;
    }

    return [...chosen].sort((a, b) => a - b)
      .map(index => `【原文第 ${index + 1} 节/段落】\n${chunks[index]}`).join("\n\n---\n\n");
  }
};
