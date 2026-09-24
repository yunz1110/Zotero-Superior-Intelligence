# 文献高亮标记（1.8.0）

## 1.8.3 保存事务死锁修复

用户提供的“正在保存高亮：第 1 / 37 条… / TimeoutError”定位了实际缺陷：外层 `Zotero.DB.executeTransaction()` 等待 `Annotations.saveFromJSON()`，后者内部强制调用 `item.saveTx()` 再开启事务；新的事务等待外层事务结束，形成循环等待。旧测试将 `saveFromJSON` 简化为直接写入，未模拟真实的事务行为。

现改为创建 Zotero 原生 annotation item，设置与官方保存接口相同的文本、分类、颜色、位置和标签，并在外层事务内调用 `item.save({skipSelect: true})`。保留权限检查、通知和整批回滚。回归测试模拟 Zotero 非重入事务，复现旧调用链的 TimeoutError，并验证新路径只开启一个事务、第二条写入失败会回滚第一条，以及成功重试后不会重复高亮。源码与自动化验证已完成，未声称在用户真实文献上完成写入实测。

事务行为参考：
- https://github.com/zotero/zotero/blob/main/chrome/content/zotero/xpcom/annotations.js
- https://github.com/zotero/zotero/blob/main/chrome/content/zotero/xpcom/data/dataObject.js
- https://github.com/zotero/zotero/blob/main/chrome/content/zotero/xpcom/db.js

## 1.8.2 空白错误诊断修复

真实用户在 1.8.1 上报告运行约两分钟后只显示空白失败原因。现有记录未保留具体阶段，因此根因仍未确认，不能认定仍是对象复制错误。

新增异常名称、错误码、嵌套原因与无详情时的兜底说明。高亮执行记录 PDF 初始化、页码元数据、逐页坐标读取、原文分句、模型筛选、去重及逐条写入阶段。结果与异常以 JSON 字符串跨窗口传递，避免依赖原生异常对象。模型网络请求失败有单独提示；非必要的 PDF 页码标签失败时使用实际页码。错误弹窗先更新，再尝试保存历史，避免历史保存失败掩盖原始错误。

新增 `node tests/errors.js` 测试空消息、原生错误码、不可访问异常属性、跨窗口结果和空消息网络失败。本次未能从真实 Zotero 错误控制台读取堆栈；此版本用于修正已知错误传递缺陷并确定剩余问题的准确阶段，不宣称此前运行失败的根因已完全修复。

## 1.8.1 修复

PDF.js 页面参数先通过 `Components.utils.cloneInto` 复制到 PDF iframe，再调用 `getPageData`，避免 Worker 收到插件作用域的跨域包装对象而抛出 `The object could not be cloned.`。页面结果转为插件本地 JSON 数据后再计算坐标。读取失败时显示具体页码；弹窗区分运行中、成功和失败，失败后明确提示任务已停止。新增双作用域读取回归测试；尚未在真实 Zotero 环境复现并验证修复。

跨作用域参数参考：https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts/cloneInto

在文献库选择一个条目或 PDF 附件，打开 工具 → SI，在“总结类型”选择“文献高亮标记”，点击“为所选文献添加高亮”。普通文献条目使用第一个可读取的 PDF；指定某个附件时只处理该附件。

颜色：黄色结论、蓝色机制、绿色方法、红色空白、紫色可引用。结果区列出实际保存的原句与页码，任务历史保存状态及耗时。

实现约束：

- 读取 Zotero PDF 阅读器的字符和原生 PDF 坐标，使用句子编号进行候选选择。AI 仅选择和分类，不能提供高亮坐标。
- 每条最多连续 3 个完整句子；模型返回的原文必须与 PDF 提取文本一致（仅统一排版空白），否则跳过。跨页句子支持相邻两页；无法准确定位时不写入。
- 提示模型以约 8% 为目标，保留最有价值的约 5%–15%，不强制凑足下限。本插件已有高亮加上本次新增高亮不超过可提取全文非空白字符数的 15%。普通背景、参考文献不应入选；科研价值分类仍依赖模型判断。
- 跳过已有高亮/下划线区域、重复原文和相互重叠的候选，不修改已有批注。同一附件禁止同时运行两个本插件高亮任务。
- 所有模型请求与原文校验完成后，在一个数据库事务内保存 Zotero 原生批注。数据库写入失败时回滚本次新增内容。
- 使用当前模型配置并记录 Token。长文分组处理，不截取全文开头。没有文字层的 PDF 提示先 OCR；部分页面无文字时明确报告，只处理可提取页面。
- 高亮保存在 Zotero 批注数据库中，可在阅读器查看/编辑/删除；不直接修改原 PDF 文件。标签为“SI 自动高亮”和具体类别。

接口核对（Zotero 官方源码）：

- https://github.com/zotero/reader/blob/master/src/pdf/pdf-page-data.mjs
- https://github.com/zotero/reader/blob/master/src/pdf/selection.js
- https://github.com/zotero/zotero/blob/main/chrome/content/zotero/xpcom/reader.js
- https://github.com/zotero/zotero/blob/main/chrome/content/zotero/xpcom/annotations.js

自动化验证：`node tests/auto_highlight.js`、`node tests/dashboard.js`、`node tests/smoke.js`。覆盖原句改写拒绝、比例上限、重复运行、跨页定位、坐标缺失、只读文献库、无效 JSON、事务回滚和高亮成功/失败弹窗。阅读器的私有字符坐标接口已与官方源码核对，但仍需安装至 Zotero 10 进行原生运行验证。
