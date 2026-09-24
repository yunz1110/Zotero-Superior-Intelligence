# 模板解构与资产参考目录（Template Deconstruction & Reference Catalog）

本目录负责存储与解构参考插件 `zotero-gpt.xpi` 及其关联技术文档。
输入为原始模板文件 `zotero-gpt.xpi` 及相关链接定义 `url.md`。
输出为解压后的参考代码结构、静态资源、提示词技能库及架构分析。

---

## 关键文件与资产清单

| 文件 / 目录名称 | 地位 | 功能描述 | 输入数据 | 输出数据 |
| :--- | :--- | :--- | :--- | :--- |
| `url.md` | 参考链接清单 | 记录上游开源仓库、使用指南以及 MinerU 文档解析接口地址 | 研究者手动整理 | 技术开发参考 URL |
| `zotero-gpt.xpi` | 原始参考安装包 | 社区成熟的 Zotero AI 插件安装包 (v3.1.169) | 官方发布文件 | 解压与反编译输入源 |
| `TEMPLATE_CATALOG.md` | 目录架构文档 | 说明本目录职责、解构方案及各模块角色 | 目录文件清单 | 架构全景索引 |
| `decompiled_reference/` | 解压解构目录 | 包含 XPI 解包后的完整源码与静态资源 | `zotero-gpt.xpi` | 解构后的代码与资源树 |

---

## 解构模块科学职责分析

解压目录 `decompiled_reference/` 内部各核心模块结构如下：

1. **`manifest.json`**：
   - 适配规范：明确声明 `"strict_min_version": "10.0"`，专为 Zotero 10 现代运行时环境定制。
   - 插件标识：`zoterogpt@polygon.org`。
2. **`bootstrap.js`**：
   - 生命周期管理：实现 `startup()`, `shutdown()`, `onMainWindowLoad()`, `onMainWindowUnload()` 等核心钩子。
   - 运行时沙箱：利用 `aomStartup.registerChrome` 注册资源路由，并通过 `Services.scriptloader` 注入脚本。
3. **`chrome/content/skills/*.md`**：
   - 技能提示词库：包含 `core.md`, `literature.md`, `notes.md`, `pdf.md`, `items.md` 等标准 Agent 技能定义，是构建学术 AI 提示词体系的优质资产。
4. **`chrome/content/styles/`**：
   - 样式与公式库：内置完整的 KaTeX 样式与 Web 字体（`.woff2`），支持在 Zotero 内实时渲染数学与科学公式（如 $R^2$, $\Delta T$, $\beta$ 等）。
5. **`chrome/content/pro/`（商业加密层，不予触碰）**：
   - 包含闭源商业加密模块 `pro-entry.enc` 与完整性签名 `package-integrity.json`。
   - 本项目严格遵循科研规范与法律合规底线，不破解其商业授权，而是基于开放接口与标准架构构建独立、完全自主可控的插件。
