# 浅色科研界面调整

- 工作台：白色卡片、浅灰页面底色、克制的蓝色主操作；任务状态用蓝、绿、棕区分。
- 设置：保留原有分组与控件 ID，标签和输入框对齐；窄窗口使用纵向表单，预设按钮自动换行。
- 用量统计：去除深色发光背景，保留热力图、月度趋势与筛选功能。
- 阅读器：统一浅色消息、输入区和按钮；增加空对话提示、键盘焦点与输入控件的无障碍名称。

设计参考：IBM Carbon 的浅色中性配色与留白原则。
https://carbondesignsystem.com/elements/color/overview/
https://carbondesignsystem.com/elements/spacing/overview/

验证：`node tests/smoke.js`、阅读器脚本语法检查、两份 XHTML 的 XML 解析、XPI 构建均通过。
`python docs/preview_ui.py` 从实际源文件生成静态浏览器预览，使用示例数据，不读取 API Key 或文献库。
工作台、设置表单、380px 对话区域已进行浏览器视觉检查。
预览将 XUL 容器转为 HTML，不替代 Zotero 原生窗口验证；尚未安装至 Zotero 实测。
