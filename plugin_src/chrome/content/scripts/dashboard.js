// input: User selection of Zotero literature items, prompt options, LLM profile configuration
// output: Rendered markdown summary, auto-highlight preview, batch queue status, Zotero note persistence
// pos: UI controller and interaction layer for Zotero Superior Intelligence dashboard

(function () {
  "use strict";

  window.addEventListener("load", () => {
    const app = Zotero.MinerUAI;
    document.getElementById("si-library-chat")?.addEventListener("click", () => app.openLibraryChat());
    const args = window.arguments?.[0];
    window.siSelectedItemID = args?.wrappedJSObject?.selectedItemID || args?.selectedItemID || null;
    const status = document.getElementById("mineru-dashboard-status");
    const itemLabel = document.getElementById("mineru-selected-item");
    const resultView = document.getElementById("mineru-dashboard-result");
    const summaryButton = document.getElementById("si-summary");
    const typeField = document.getElementById("si-summary-type");
    const promptField = document.getElementById("si-summary-prompt");
    const profileField = document.getElementById("si-dashboard-profile");
    const thinkingButton = document.getElementById("si-thinking"), outputField = document.getElementById("si-output-limit");
    const limits = { paper_summary: 8192, table_summary: 16384, auto_highlight: 8192 };
    let thinking = false;
    thinkingButton.addEventListener("click", () => { thinking = !thinking; thinkingButton.textContent = thinking ? "思考：开启" : "思考：关闭"; thinkingButton.setAttribute("aria-pressed", String(thinking)); });
    outputField.addEventListener("change", () => { limits[typeField.value] = Number(outputField.value); });
    const taskConfig = () => ({ ...app.getConfig(), llmThinking: thinking, llmMaxTokens: limits[typeField.value] || 8192 });
    let busy = false;
    let selection = [], stopRequested = false;
    const selectionRows = new Map();
    const pickedIDs = () => selection.filter(row => row.checked).map(row => row.id);
    const updateSelectionCount = () => {
      const count = pickedIDs().length;
      document.getElementById("si-selection-count").textContent = `已勾选 ${count} / ${selection.length} 篇`;
      if (count > 1) summaryButton.textContent = `批量${typeField.value === "auto_highlight" ? "高亮" : typeField.value === "table_summary" ? "生成表格总结" : "总结"}（${count} 篇）`;
      else summaryButton.textContent = typeField.value === "auto_highlight" ? "为所选文献添加高亮" : "生成并保存到文献笔记";
      summaryButton.disabled = busy || count === 0;
    };
    const html = (tag) => document.createElementNS("http://www.w3.org/1999/xhtml", tag);
    const renderTasks = () => {
      const data = app.getSummaryTasks();
      const running = data.items.filter((task) => task.status === "running");
      document.getElementById("si-task-total").textContent = String(data.totals.created);
      document.getElementById("si-task-running").textContent = String(running.length);
      document.getElementById("si-task-completed").textContent = String(data.totals.completed);
      document.getElementById("si-task-failed").textContent = String(data.totals.failed + data.totals.interrupted);
      for (const [containerID, tasks, emptyText] of [
        ["si-task-active-list", running, "当前没有进行中的文献任务。"],
        ["si-task-history-list", data.items.filter((task) => task.status !== "running"), "尚无历史任务。"]
      ]) {
        const container = document.getElementById(containerID);
        container.replaceChildren();
        if (!tasks.length) {
          const label = html("span"); label.className = "si-task-empty"; label.textContent = emptyText; container.append(label);
        }
        for (const task of tasks) {
          const row = html("div"); row.className = "si-task-row"; row.dataset.status = task.status;
          const title = html("button"); title.textContent = task.title; title.type = "button";
          title.className = "si-task-link";
          title.title = "在文献库中定位此文献";
          title.addEventListener("click", async () => {
            try { await app.locateSummaryTask(task); }
            catch (error) { status.textContent = error.message; }
          });
          const detail = html("small");
          const state = { running: "进行中", completed: task.promptType === "auto_highlight" ? "高亮处理完成" : "已完成并保存笔记", failed: "失败", interrupted: task.noteID ? "未完成 · 部分已保存" : "中断" }[task.status] || task.status;
          const ms = task.durationMs ?? (task.status === "interrupted" ? null : task.finishedAt ? Date.parse(task.finishedAt) - Date.parse(task.createdAt) : Date.now() - Date.parse(task.createdAt));
          const seconds = Math.max(0, Math.round(ms / 1000));
          const elapsed = ms === null || !Number.isFinite(ms) ? "耗时未记录" : `总耗时 ${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
          detail.textContent = `${state} · ${task.promptType === "auto_highlight" ? "文献高亮标记" : task.promptType === "table_summary" ? "表格总结" : "文献总结"} · ${elapsed} · 配置 ${task.profileSlot} · ${new Date(task.createdAt).toLocaleString("zh-CN")} · ${task.stage || ""}`;
          row.append(title, detail); container.append(row);
        }
      }
    };
    renderTasks();

    const loadPrompt = () => {
      outputField.value = String(limits[typeField.value] || 8192);
      const highlight = typeField.value === "auto_highlight";
      promptField.value = highlight ? app.getHighlightRules() : app.getSummaryPrompt(typeField.value);
      promptField.readOnly = highlight;
      document.getElementById("si-prompt-save").hidden = highlight;
      document.getElementById("si-prompt-reset").hidden = highlight;
      document.getElementById("si-highlight-legend").hidden = !highlight;
      summaryButton.textContent = highlight ? "为所选文献添加高亮" : "生成并保存到文献笔记";
      document.getElementById("si-action-help").textContent = highlight
        ? "将按以上规则标记所选文献的 PDF 原句，目标约 5%–15%，宁少勿滥；重复内容会跳过。需要可定位文字层，长文将分组分析并使用当前模型的 Token。"
        : "预设提示词要求中文学术表达；专业术语首次出现可附英文。生成的结果会自动保存为当前文献的子笔记。";
      resultView.dataset.mode = highlight ? "highlight" : "summary";
      updateSelectionCount();
    };
    loadPrompt();
    typeField.addEventListener("change", loadPrompt);
    document.getElementById("si-prompt-save").addEventListener("click", () => {
      try {
        app.saveSummaryPrompt(typeField.value, promptField.value);
        status.textContent = "提示词已保存。";
      } catch (error) { status.textContent = error.message; }
    });
    document.getElementById("si-prompt-reset").addEventListener("click", () => {
      promptField.value = app.resetSummaryPrompt(typeField.value);
      status.textContent = "已恢复并保存预设提示词。";
    });

    const refresh = () => {
      const firstID = pickedIDs()[0];
      const item = firstID ? Zotero.Items.get(firstID) : null;
      itemLabel.textContent = pickedIDs().length > 1 ? `本次处理 ${pickedIDs().length} 篇文献` : item?.getField?.("title") || item?.attachmentFilename ||
        "未选择文献。请在 Zotero 文献列表中选择条目。";
      const config = app.getConfig();
      profileField.replaceChildren();
      app.getProfiles().forEach((profile, index) => {
        const option = html("option"); option.value = String(index + 1);
        option.textContent = `${profile.name || `配置 ${index + 1}`} · ${profile.model || "未填写模型"}`;
        profileField.append(option);
      });
      profileField.value = String(config.llmSlot);
      document.getElementById("mineru-current-config").textContent =
        `MinerU：${config.mineruMode === "precise" ? `精准模式（${config.mineruModel}）` : "Agent 模式"}；` +
        `模型配置 ${config.llmSlot}：${config.llmModel || "未填写"}；API Key：${config.llmApiKey ? "已填写" : "未填写"}`;
      return item;
    };
    window.siLoadSelection = ids => {
      if (busy) { status.textContent = "队列正在运行，结束后可重新读取文献库选择。"; return; }
      selection = [...new Set(Array.from(ids || []))].filter(Number.isInteger).map(id => ({ id, checked: true }));
      const list = document.getElementById("si-selection-list"); list.replaceChildren(); selectionRows.clear();
      for (const entry of selection) {
        const item = Zotero.Items.get(entry.id);
        const row = html("div"); row.className = "si-selection-row";
        const label = html("label"), checkbox = html("input"), name = html("span"), state = html("small");
        checkbox.type = "checkbox"; checkbox.checked = true;
        name.textContent = item?.getField?.("title") || item?.attachmentFilename || `文献 ${entry.id}`;
        state.textContent = "待处理";
        checkbox.addEventListener("change", () => { if (!busy) { entry.checked = checkbox.checked; updateSelectionCount(); refresh(); } });
        label.append(checkbox, name); row.append(label, state); list.append(row);
        selectionRows.set(entry.id, { row, state, checkbox });
      }
      updateSelectionCount(); refresh();
    };
    const initialArgs = args?.wrappedJSObject || args;
    window.siLoadSelection(initialArgs?.selectedItemIDs || (window.siSelectedItemID ? [window.siSelectedItemID] : app.getSelectedItemIDs()));
    document.getElementById("si-selection-refresh").addEventListener("click", () => window.siLoadSelection(app.getSelectedItemIDs()));
    for (const [id, checked] of [["si-selection-all", true], ["si-selection-none", false]]) {
      document.getElementById(id).addEventListener("click", () => {
        if (busy) return;
        selection.forEach(entry => { entry.checked = checked; selectionRows.get(entry.id).checkbox.checked = checked; });
        updateSelectionCount(); refresh();
      });
    }
    profileField.addEventListener("change", () => {
      app.setActiveProfile(Number(profileField.value));
      refresh();
      status.textContent = `已切换到${app.getProfiles()[app.activeProfile() - 1].name}。`;
    });
    window.addEventListener("focus", () => {
      if (!busy) {
        const currentIDs = app.getSelectedItemIDs?.() || [];
        if (currentIDs.length && JSON.stringify(currentIDs) !== JSON.stringify(selection.map(s => s.id))) {
          window.siLoadSelection(currentIDs);
        } else {
          refresh();
        }
        renderTasks();
      }
    });

    const setQueueBusy = value => {
      busy = value;
      for (const id of ["si-thinking", "si-output-limit", "si-selection-refresh", "si-selection-all", "si-selection-none", "si-summary-type", "si-dashboard-profile", "si-summary-prompt", "si-prompt-save", "si-prompt-reset", "mineru-dashboard-extract"]) document.getElementById(id).disabled = value;
      selectionRows.forEach(row => { row.checkbox.disabled = value; });
      updateSelectionCount();
    };
    document.getElementById("si-batch-stop").addEventListener("click", () => {
      stopRequested = true;
      document.getElementById("si-batch-stop").disabled = true;
      document.getElementById("si-summary-dialog-hint").textContent = "将完成当前文献后停止，剩余文献不会执行。";
      status.textContent = "已请求停止：当前文献完成后结束队列。";
    });

    const runBatch = async () => {
      const ids = pickedIDs(), type = typeField.value, config = taskConfig(), prompt = promptField.value;
      setQueueBusy(true); stopRequested = false; resultView.replaceChildren();
      const stopButton = document.getElementById("si-batch-stop"); stopButton.hidden = false; stopButton.disabled = false;
      const dialog = document.getElementById("si-summary-dialog"), progress = document.getElementById("si-summary-progress");
      const title = document.getElementById("si-summary-dialog-title"), hint = document.getElementById("si-summary-dialog-hint");
      title.textContent = "正在批量处理文献";
      hint.textContent = "关闭提示后队列继续运行；可在工作台选择完成当前文献后停止。";
      progress.textContent = `准备处理 ${ids.length} 篇文献…`; if (!dialog.open) dialog.showModal();
      for (const id of ids) { const row = selectionRows.get(id); row.state.textContent = "等待中"; row.row.dataset.status = "queued"; }
      try {
        const totals = JSON.parse(await app.runBatch(ids, type, config, prompt, json => {
          const event = JSON.parse(json), row = selectionRows.get(event.itemID);
          if (event.kind === "progress") {
            progress.textContent = `[${event.index}/${event.total}] ${event.title}\n${event.message}`;
            status.textContent = progress.textContent;
            if (row) { row.state.textContent = "处理中"; row.row.dataset.status = "running"; }
          } else if (event.kind === "item") {
            const state = { partial: "未完成（已保存）", completed: "已完成", failed: "失败", skipped: "重复跳过", stopped: "未执行" }[event.status];
            if (row) { row.state.textContent = state; row.row.dataset.status = event.status; }
            const details = html("details"), heading = html("summary"), message = html("p");
            details.className = "si-batch-result";
            details.open = true;
            heading.textContent = `${event.title || `文献 ${event.itemID}`} · ${state}`;
            message.textContent = event.message; details.append(heading, message);
            if (event.result?.markdown) { const content = html("div"); app.renderMarkdown(content, event.result.markdown); details.append(content); }
            for (const h of event.result?.highlights || []) {
              const quote = html("blockquote"); quote.textContent = `【${h.category}】第 ${h.pageLabel} 页：${h.text}`; details.append(quote);
            }
            resultView.append(details);
          }
          renderTasks();
        }, () => stopRequested || window.closed));
        title.textContent = totals.stopped ? "批处理已停止" : "批处理已结束";
        progress.textContent = `成功 ${totals.completed} 篇 · 未完成并保存 ${totals.partial || 0} 篇 · 失败 ${totals.failed} 篇 · 重复跳过 ${totals.skipped} 篇 · 未执行 ${totals.stopped} 篇`;
        status.textContent = progress.textContent; hint.textContent = "每篇结果可在下方展开查看；失败文献可重新勾选后重试。";
      } catch (error) {
        title.textContent = "批处理失败"; progress.textContent = app.describeError(error);
        status.textContent = progress.textContent; hint.textContent = "队列已停止，可根据错误提示重试。";
      } finally {
        stopButton.hidden = true; setQueueBusy(false); renderTasks();
        if (!window.closed && !dialog.open) dialog.showModal();
      }
    };

    const summarize = async () => {
      if (busy) return;
      if (pickedIDs().length > 1) return runBatch();
      const item = refresh();
      if (!item) { status.textContent = "请先在文献列表中选择条目。"; return; }
      setQueueBusy(true);
      const selectedRow = selectionRows.get(item.id);
      if (selectedRow) { selectedRow.state.textContent = "处理中"; selectedRow.row.dataset.status = "running"; }
      const actionType = typeField.value;
      const highlight = actionType === "auto_highlight";
      const actionName = highlight ? "文献高亮" : "总结";
      const capturedPrompt = promptField.value;
      resultView.replaceChildren();
      summaryButton.disabled = true;
      typeField.disabled = true;
      profileField.disabled = true;
      const dialog = document.getElementById("si-summary-dialog");
      const progress = document.getElementById("si-summary-progress");
      const dialogTitle = document.getElementById("si-summary-dialog-title");
      const dialogHint = document.getElementById("si-summary-dialog-hint");
      dialogHint.textContent = "关闭提示后任务会继续运行，可在“文献任务”中查看进度。";
      dialogTitle.textContent = highlight ? "正在标记文献" : "正在生成总结";
      progress.textContent = "任务已开始，正在读取文献。长文会分组分析，可能需要更多时间与 Token。";
      if (!dialog.open) dialog.showModal();
      let taskID = null;
      let lastStage = "准备任务";
      try {
        if (!highlight) app.saveSummaryPrompt(actionType, capturedPrompt);
        const config = taskConfig();
        taskID = app.startSummaryTask({
          title: item.getField?.("title") || item.attachmentFilename || "未命名文献",
          promptType: actionType, profileSlot: config.llmSlot, itemID: item.parentID || item.id
        });
        renderTasks();
        const report = (message) => {
          lastStage = message;
          status.textContent = message;
          progress.textContent = message;
          app.updateSummaryTask(taskID, { stage: message });
          renderTasks();
        };
        if (highlight) {
          const response = JSON.parse(await app.highlightItem(item, report, config));
          if (!response.ok) throw new Error(response.error || `失败阶段：${lastStage}；底层组件未提供错误详情`);
          const result = response.result;
          const message = result.count
            ? `已添加 ${result.count} 条高亮，本次标记约占可提取原文的 ${result.percent}%。`
            : "未新增高亮：没有通过原文、去重及比例检查的候选内容，或已达到标记上限。";
          status.textContent = message + (result.emptyPages ? ` ${result.emptyPages} 页无文字层，仅分析可提取的原文。` : "");
          const resultTitle = html("p"); resultTitle.textContent = status.textContent; resultView.append(resultTitle);
          for (const h of result.highlights) {
            const entry = html("div"); entry.className = "si-highlight-result";
            entry.style.borderLeftColor = h.color;
            const label = html("strong"); label.textContent = `【${h.category}】第 ${h.pageLabel} 页`;
            const quote = html("blockquote"); quote.textContent = h.text;
            entry.append(label, quote); resultView.append(entry);
          }
          app.updateSummaryTask(taskID, { status: "completed", stage: status.textContent });
        } else {
        const result = await app.summarizeItem(item, actionType, report, config, capturedPrompt);
        app.renderMarkdown(resultView, result.markdown);
        app.updateSummaryTask(taskID, { stage: "正在保存文献笔记…" });
        renderTasks();
        const note = await app.saveSummary(result);
        app.updateSummaryTask(taskID, { status: result.incomplete ? "interrupted" : "completed", stage: result.incomplete ? "未完成：部分结果已保存" : "文献笔记已保存", noteID: note?.id || null });
        renderTasks();
        status.textContent = (result.incomplete ? "未完成：已达到输出上限，部分结果已保存到笔记。" : "总结已生成并保存到当前文献笔记。") + (result.timings ? ` 正文准备 ${(result.timings.extractionMs/1000).toFixed(1)} 秒${result.timings.cached ? "（复用）" : ""}，模型生成 ${(result.timings.modelMs/1000).toFixed(1)} 秒。` : "");
        }
        renderTasks();
        dialogTitle.textContent = status.textContent.startsWith("未完成") ? "未完成 · 部分结果已保存" : `${actionName}已完成`;
        if (selectedRow) { selectedRow.state.textContent = status.textContent.startsWith("未完成") ? "未完成" : "已完成"; selectedRow.row.dataset.status = status.textContent.startsWith("未完成") ? "partial" : "completed"; }
        dialogHint.textContent = "任务已结束，可以关闭提示查看结果。";
        progress.textContent = status.textContent;
        if (!dialog.open) dialog.showModal();
      } catch (error) {
        const detail = app.describeError(error);
        if (selectedRow) { selectedRow.state.textContent = "失败"; selectedRow.row.dataset.status = "failed"; }
        const message = detail.includes("失败阶段：") ? detail : `失败阶段：${lastStage}\n原因：${detail}`;
        status.textContent = `${actionName}失败：${message}`;
        dialogTitle.textContent = `${actionName}失败`;
        dialogHint.textContent = "任务已停止。解决问题后可重新点击按钮重试。";
        progress.textContent = status.textContent;
        if (!dialog.open) dialog.showModal();
        // A failed history write must not prevent the original error being shown.
        try {
          if (taskID) app.updateSummaryTask(taskID, { status: "failed", stage: message });
          renderTasks();
        } catch (historyError) {
          dialogHint.textContent = "任务已停止；历史记录更新失败，请保留上方错误信息。";
          try { Zotero.logError(historyError); } catch (_) {}
        }
        try { Zotero.logError(error); } catch (_) {}
      } finally {
        setQueueBusy(false);
      }
    };

    summaryButton.addEventListener("click", summarize);
    document.getElementById("si-summary-dialog-close").addEventListener("click", () => document.getElementById("si-summary-dialog").close());
    document.getElementById("mineru-dashboard-extract").addEventListener("click", () => {
      const item = refresh();
      if (!item) { status.textContent = "请先在文献列表中选择条目。"; return; }
      app.handleExtractMarkdown(item);
      status.textContent = "正在提取 PDF 正文，请查看 Zotero 进度提示。";
    });
    document.getElementById("mineru-dashboard-preferences").addEventListener("click", () => app.openPreferences());
  }, { once: true });
})();
