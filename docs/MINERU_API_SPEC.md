# MinerU 文档解析接口与插件集成技术规范（MinerU Document Parsing & Integration Specification）

本规范详细定义了 MinerU 智能文档解析云端服务在 Zotero 10 插件中的接入流程、数据契约与异常处理策略。

---

## 1. 概述与核心模式对比

MinerU（由上海人工智能实验室 OpenDataLab 开发）是面向大语言模型（Large Language Model, LLM）与检索增强生成（Retrieval-Augmented Generation, RAG）的高性能文档解析工具，能够精准提取复杂多栏学术论文中的版面、文本、表格与数学公式（包含 LaTeX 与 Unicode 格式）。

平台提供两种工作模式，插件同时支持并根据用户设置无缝切换：

| 对比维度 | ⚡ Agent 轻量解析模式 | 🎯 精准解析模式 |
| :--- | :--- | :--- |
| **Token 授权** | **❌ 免登录、无需 Token（IP 限频防滥用）** | **✅ 必须携带 Bearer Token（可在后台创建）** |
| **文件大小限制** | ≤ 10 MB | ≤ 200 MB |
| **文件页数限制** | ≤ 20 页 | ≤ 200 页 |
| **批量支持** | 仅单文件异步解析 | 支持批量申请与解析（≤ 50 个） |
| **模型版本** | 固定轻量 pipeline 模型 | 支持 `vlm`（多模态视觉模型，推荐）、`pipeline`、`MinerU-HTML` |
| **输出格式** | 直接返回 `full.md` 的 CDN 下载链接 | 返回完整 Zip 压缩包（含 `full.md`、`layout.json`、图表资源） |
| **适用科研场景** | 快速精读单篇学术短文、综述核心章节或免配置即开即用 | 专著、大部头长篇文献、含大量复杂公式和图表的高精度提取 |

---

## 2. 模式一：⚡ Agent 轻量解析接口规范（免 Token）

### 2.1 申请预签名上传链接
- **请求方法**：`POST`
- **请求地址**：`https://mineru.net/api/v1/agent/parse/file`
- **请求头**：`Content-Type: application/json`（无需 Authorization）
- **请求体（JSON）**：
  ```json
  {
    "file_name": "research_paper.pdf",
    "language": "ch",
    "enable_table": true,
    "enable_formula": true,
    "is_ocr": false,
    "page_range": "1-20"
  }
  ```
- **响应体示例**：
  ```json
  {
    "code": 0,
    "msg": "ok",
    "trace_id": "c876cd60b202f2396de1f9e39a1b0172",
    "data": {
      "task_id": "a90e6ab6-44f3-4554-b459-b62fe4c6b43605",
      "file_url": "https://oss-mineru.openxlab.org.cn/agent/a90e6ab6-...pdf?Expires=..."
    }
  }
  ```

### 2.2 上传本地 PDF 二进制数据
- **请求方法**：`PUT`
- **请求地址**：`{file_url}`（由 2.1 返回的签名 URL）
- **请求头**：无须设置 `Content-Type`
- **请求体**：PDF 文件的原始二进制流（Raw Binary Stream）
- **状态响应**：HTTP 200 即代表上传成功，MinerU 后端自动感知并触发异步解析。

### 2.3 轮询查询解析结果
- **请求方法**：`GET`
- **请求地址**：`https://mineru.net/api/v1/agent/parse/{task_id}`
- **响应状态流转**：
  - `waiting-file`：等待文件上传中
  - `running` / `pending`：排队或解析计算中
  - `done`：解析完成，此时字段 `markdown_url` 包含最终排版好的 Markdown 文本 CDN 直链
  - `failed`：解析失败，携带 `err_code` 与 `err_msg`
- **响应体示例**：
  ```json
  {
    "code": 0,
    "msg": "ok",
    "data": {
      "task_id": "a90e6ab6-44f3-4554-b459-b62fe4c6b43605",
      "state": "done",
      "markdown_url": "https://cdn-mineru.openxlab.org.cn/pdf/a90e6ab6-.../full.md"
    }
  }
  ```

---

## 3. 模式二：🎯 精准解析接口规范（Token 授权）

### 3.1 批量申请上传链接
- **请求方法**：`POST`
- **请求地址**：`https://mineru.net/api/v4/file-urls/batch`
- **请求头**：
  - `Content-Type: application/json`
  - `Authorization: Bearer {token}`
- **请求体（JSON）**：
  ```json
  {
    "files": [
      { "name": "paper_full.pdf", "data_id": "zotero_item_1234" }
    ],
    "model_version": "vlm"
  }
  ```
- **响应体示例**：
  ```json
  {
    "code": 0,
    "data": {
      "batch_id": "2bb2f0ec-a336-4a0a-b61a-241afaf9cc87",
      "file_urls": [
        "https://oss-mineru.openxlab.org.cn/v4/.../paper_full.pdf?OSSAccessKeyId=..."
      ]
    }
  }
  ```

### 3.2 上传与轮询
- 客户端使用 `PUT` 方法将本地 PDF 文件内容直接流式传输到 `file_urls[0]`。
- 轮询地址：`GET https://mineru.net/api/v4/extract-results/batch/{batch_id}`
- 请求头：`Authorization: Bearer {token}`
- 当 `state == "done"` 时，获取 `full_zip_url`。

---

## 4. Zotero 插件内部数据流集成设计

```
[ 用户在 Zotero 右键论文或点击侧边栏 ]
                  │
                  ▼
   1. 提取 Zotero 本地 PDF 路径
      (item.getFilePath() / attachment.getFile())
                  │
                  ▼
   2. 调用 MinerUClient 发送解析任务
      (Agent 免 Token 模式 或 精准 Token 模式)
                  │
                  ▼
   3. 流式读取本地文件并 PUT 上传至 MinerU OSS
                  │
                  ▼
   4. 异步轮询任务状态 (间隔 2.5 秒，显示进度通知)
                  │
                  ▼
   5. 获取 full.md Markdown 结构化文本
                  │
         ┌────────┴───────────────────────────┐
         ▼                                    ▼
[ 沉淀为 Zotero 独立笔记 ]            [ 载入 AI 侧边栏对话上下文 ]
- 自动格式化标题、作者、年份         - 支持就全文向 LLM 提问
- 渲染公式与表格                     - 自动执行方法/结论结构化精读
- 自动为条目添加 #MinerU 标签        - 流式生成研究洞见
```
