# Zotero Superior Intelligence (SI)

<div align="center">

[![Zotero](https://img.shields.io/badge/Zotero-7.0%20%7C%2010.0-blue.svg)](https://www.zotero.org/)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-green.svg)](LICENSE)
[![MinerU API](https://img.shields.io/badge/MinerU%20API-v1%20%7C%20v4-orange.svg)](https://mineru.net/)
[![Release](https://img.shields.io/badge/Release-v1.0.0-brightgreen.svg)](https://github.com/yunz1110/Zotero-Superior-Intelligence/releases)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/yunz1110/Zotero-Superior-Intelligence/pulls)

**为现代科研工作流打造的 Zotero 7/10 智能文献助手**  
深度集成 OpenDataLab MinerU 高精度文档解析与多主流大模型（DeepSeek、OpenAI、Claude、Ollama），打造阅读、解析、精读、检索与笔记沉淀的全链路学术闭环。

[English](#english-summary) | [功能特性](#-核心功能特性) | [快速安装](#-快速安装指南) | [配置说明](#-配置与使用指南) | [开发构建](#-开发者指南)

</div>

---

## 📖 项目简介

**Zotero Superior Intelligence (SI)** 是一款专为 Zotero 7 及下一代 Zotero 10（Gecko ESR 现代平台）量身定制的开源文献研读与学术 AI 插件。

传统学术阅读工具在处理论文时普遍面临“双栏版面错乱”、“数学公式丢失”、“数据表格错位”等核心痛点。本项目通过深度整合 **OpenDataLab MinerU** 这一领先的学术文档解析引擎，将复杂 PDF 精准转化为保留 LaTeX 数学公式、三线表格与章节骨架的结构化学术 Markdown，并以此为高质量上下文，驱动大语言模型进行学术精读、方法比对与全库知识问答。

---

## ✨ 核心功能特性

### 1. 📑 高保真学术文档结构化解析 (MinerU Integration)
- **双模解析体系**：
  - **免 Token 轻量模式 (Agent 模式)**：无需注册或填写 API Token，直接调用轻量接口处理 ≤20 页、≤10 MB 的学术论文，开箱即用。
  - **高精度批量模式 (Precise 模式)**：使用个人 MinerU API Token，支持 ≤200 页的大型专著与技术报告，精准识别公式、复杂排版与扫描件。
- **自动笔记与标签沉淀**：解析完成后自动在文献条目下生成层级化 Markdown 子笔记，并自动追加 `#MinerU`、`#SI-Parsed` 索引标签。

### 2. 🤖 多模型自由切换与多配置轮换 (Multi-LLM Profiles)
- **主流模型全面适配**：原生支持 **DeepSeek**（`deepseek-flash`, `deepseek-chat`）、**OpenAI**（GPT-4o, GPT-4o-mini）、**Anthropic Claude**，以及 **Ollama / vLLM / LocalAI** 本地私有化部署。
- **多 Profile 独立配置**：支持为不同场景（如“快速摘要”、“深度方法分析”、“英文翻译润色”）配置独立的服务商、密钥与提示词，并在工作台一秒切换。
- **Token 消耗精准计量**：实时统计每个模型调用的 Prompt Tokens、Completion Tokens 及估算花费，科研预算一目了然。

### 3. 💬 PDF 原文阅读器侧边栏精读 (Reader Sidebar Chat)
- **原生侧边栏沉浸式交互**：无缝内嵌于 Zotero 10 PDF 阅读器右侧工具抽屉。
- **学术快捷问答**：预置“总结论文核心贡献”、“详解技术方法”、“剖析实验局限”、“提炼结论”等快捷学术指令。
- **一键存为笔记**：高质量问答成果可一键沉淀为条目关联富文本笔记，支持 KaTeX 数学公式渲染（如 $\Delta T$, $R^2$, $\beta$）。

### 4. 🖋️ 学术文献智能定位高亮 (Scholarly Auto-Highlight)
- **要点智能识别**：自动在论文原文中检索“核心结论”、“关键方法”、“创新机制”等学术要点。
- **精准坐标定位**：结合 PDF 字符坐标流，自动在 PDF 原文中创建语义色彩编码的高亮批注（Annotations），告别手工划线。

### 5. 📚 全库知识检索与跨篇对话 (Library-Wide Synthesis)
- **本地倒排索引构建**：离线提取个人文献库所有元数据、摘要与关联笔记，构建结构化知识索引。
- **跨文献交叉问答**：提出综合性研究问题，AI 跨篇检索多篇文献，生成对比分析并附带精准的文献引用卡片。

### 6. ⚡ 批量队列处理与中断保护 (Batch Processing Engine)
- **串行异步队列**：支持多选数十篇文献一键批量解析与总结。
- **单篇容错隔离**：任意文献因网络或格式失败不阻断后续任务，支持随时安全暂停与断点续提。

---

## 🖼️ 界面预览

| 科研工作台与多任务管理 | PDF 阅读器侧边栏对话 |
| :---: | :---: |
| ![Dashboard](docs/ui-preview/token-usage.png) | ![Library Chat](docs/ui-preview/library-chat.png) |

> 提示：可在浏览器中直接打开 `docs/ui-preview/*.html` 查看无需 Zotero 运行时的界面预览。

---

## 🚀 快速安装指南

### 方式一：直接安装官方预编译包（推荐）

1. 前往本仓库 [Releases](https://github.com/yunz1110/Zotero-Superior-Intelligence/releases) 页面，或在 `dist/` 目录中下载最新版安装包：
   - 📥 **`zotero-superior-intelligence-1.0.0.xpi`**
2. 启动 **Zotero**（支持 Zotero 7.0 及以上版本）。
3. 点击顶部菜单栏：**工具 (Tools)** -> **插件 (Add-ons / Plugins)**。
4. 将下载的 `.xpi` 文件直接**拖入插件窗口**（或点击右上角齿轮图标选择 `Install Add-on From File...`）。
5. 提示安装成功后，重启 Zotero 即可。

### 方式二：从源码打包构建

```bash
# 1. 克隆代码仓库
git clone https://github.com/yunz1110/Zotero-Superior-Intelligence.git
cd Zotero-Superior-Intelligence

# 2. 执行打包脚本
python build_xpi.py
# 或使用 npm
npm run build

# 3. 生成的安装包位于 dist/ 目录：
# dist/zotero-superior-intelligence-1.0.0.xpi
```

---

## ⚙️ 配置与使用指南

### 1. 打开插件首选项
在 Zotero 主界面点击：**编辑 (Edit)** -> **首选项 (Preferences)** -> 选择 **Superior Intelligence (SI)** 标签页。

### 2. 配置 MinerU 解析服务
- **模式选择**：
  - **轻量模式 (Agent)**：免费免 Token，适合绝大部分常规期刊与会议论文（≤20 页）。
  - **高精度模式 (Token 授权)**：前往 [OpenDataLab MinerU 官网](https://mineru.net/) 注册并获取 API Token 填入对应输入框。
- 点击 **测试 MinerU 接口** 按钮，验证网络与授权连通性。

### 3. 配置大语言模型 (LLM)
- 选择服务商（如 DeepSeek、OpenAI、Claude 或 Custom/Ollama）。
- 填写 API Base（如 `https://api.deepseek.com/v1`）与 API Key。
- 选择模型名称（如 `deepseek-flash`）。
- 点击 **测试大模型连接** 确保连通无误。

### 4. 日常使用
- **右键提取**：在文献列表选中条目，右击选择 **📄 MinerU: 提取全文 Markdown 笔记** 或 **🤖 MinerU + AI: 学术方法与核心贡献精读**。
- **阅读器对话**：双击打开 PDF，在右侧工具栏点击 **SI 对话** 图标即可展开文献研读侧边栏。
- **全库问答**：点击顶部工具栏 **SI 知识库** 图标，即可开启全库文献综合检索。

---

## 🛠️ 项目工程结构

```
zotero-superior-intelligence/
├── README.md                  # 项目开源主页与使用指南
├── LICENSE                    # AGPL-3.0 开源协议
├── package.json               # 项目元数据与脚本入口
├── build_xpi.py               # 核心构建与 XPI 自动化打包工具
├── PROJECT_ARCHITECTURE.md    # 顶层架构规范与数据流设计
├── EXPERIMENT_LOG.md          # 详细研发、实验与迭代日志
├── .github/
│   └── workflows/build.yml    # GitHub Actions 自动化持续集成
├── plugin_src/                # 插件完整核心源码
│   ├── manifest.json          # Zotero 10 扩展清单定义
│   ├── bootstrap.js           # 扩展生命周期管理入口
│   ├── chrome.manifest        # Gecko chrome 资源协议注册
│   ├── prefs.js               # 默认参数首选项
│   ├── chrome/content/
│   │   ├── dashboard.xhtml    # 科研工作台界面
│   │   ├── library.xhtml      # 全库检索问答界面
│   │   ├── preferences.xhtml  # 插件首选项面板
│   │   ├── scripts/           # 业务逻辑与客户端实现
│   │   ├── styles/            # KaTeX 数学公式渲染库与样式
│   │   └── icons/             # 界面矢量与标清图标
│   └── locale/                # 多语言本地化（zh-CN, en-US）
├── tests/                     # 自动化端到端与单元测试套件
│   ├── TESTS_CATALOG.md       # 测试目录全景索引
│   ├── smoke.js               # 核心冒烟测试
│   └── ...                    # 各功能单元测试脚本
├── docs/                      # 架构规范与开发文档
│   ├── DOCS_CATALOG.md        # 文档目录索引
│   ├── MINERU_API_SPEC.md     # MinerU 接口对接协议
│   ├── preview_ui.py          # 独立浏览器 UI 预览生成工具
│   └── ui-preview/            # 离线预览与截图资产
└── dist/                      # 分发产物目录
    ├── DIST_CATALOG.md        # 分发目录规范说明
    └── zotero-superior-intelligence-1.0.0.xpi
```

---

## 🧪 测试套件运行

本项目内置完整的无头测试套件，在离线 Mock 环境下校验全部业务逻辑与安全脱敏机制：

```bash
# 执行核心冒烟测试
node tests/smoke.js

# 执行全部测试套件
npm run test:all
```

---

## <a id="english-summary"></a>🌐 English Summary

**Zotero Superior Intelligence (SI)** is an open-source AI literature copilot plugin designed for **Zotero 7 and Zotero 10** (Gecko ESR platform). It seamlessly integrates **OpenDataLab MinerU** high-accuracy document parsing (extracting LaTeX math formulas, tables, and dual-column layouts) with state-of-the-art LLMs (DeepSeek, OpenAI, Claude, Ollama).

### Highlights:
- **High-fidelity PDF extraction** via MinerU Agent & Precise APIs.
- **Embedded PDF Reader Chat** with one-click note saving and KaTeX rendering.
- **Library-wide knowledge base retrieval** with citation attribution cards.
- **Scholarly auto-highlighting** based on PDF text bounding boxes.
- **Multi-profile LLM management** with token usage tracking.
- **Batch processing queue** with fault isolation.

---

## 📄 开源许可证 (License)

本项目基于 [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE) 协议开源。

## 🤝 鸣谢与生态

- [Zotero](https://www.zotero.org/) - 现代开源文献管理软件
- [OpenDataLab MinerU](https://github.com/opendatalab/MinerU) - 一站式开源高质量数据提取工具
- [KaTeX](https://katex.org/) - 高性能 Web 数学公式渲染引擎
