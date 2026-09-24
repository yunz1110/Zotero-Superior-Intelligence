# 发布分发产物目录（Distribution & Artifacts Catalog）

本目录负责存放由 `build_xpi.py` 自动化打包构建生成的 Zotero 扩展安装包（`.xpi`）。
输入为经过测试与验证的 `plugin_src/` 核心源码及静态资产。
输出为可直接拖拽至 Zotero 7/10 安装的经过 ZIP 压缩的扩展安装包。

---

## 安装包命名与发布规范

1. **命名规范**：`zotero-superior-intelligence-MAJOR.MINOR.PATCH.xpi`
2. **Git 归档策略**：
   - 遵循开源最佳实践，历史构建安装包已通过 `.gitignore` 排除，避免二进制文件导致 Git 仓库历史体积持续膨胀。
   - 本地开发可随时通过 `python build_xpi.py`（或 `npm run build`）重新生成对应版本的安装包。
   - 仓库内仅受控维护当前最新正式发布包 `zotero-superior-intelligence-1.0.0.xpi`。
   - 正式版本发布建议通过 GitHub Releases 进行二进制附件分发。

---

## 核心资产说明

| 文件名 | 地位 | 功能描述 | 适用平台 |
| :--- | :--- | :--- | :--- |
| `DIST_CATALOG.md` | 目录架构文档 | 说明分发目录职责与安装包命名规则 | - |
| `zotero-superior-intelligence-1.0.0.xpi` | 最新正式发布包 | 包含完整 UI、MinerU 客户端、多模型支持与智能高亮特性 | Zotero 7 / Zotero 10 (Gecko ESR) |

---

## 安装说明

1. 下载最新的 `zotero-superior-intelligence-*.xpi` 文件。
2. 打开 Zotero 客户端，点击顶部菜单栏 **工具 (Tools)** -> **插件 (Add-ons / Plugins)**。
3. 将下载的 `.xpi` 文件直接拖拽入插件管理窗口，或点击齿轮图标选择 **Install Add-on From File...**。
4. 重启 Zotero 即可完成安装。
