# input: plugin_src/chrome/content/*.xhtml, scripts/reader_chat.js
# output: docs/ui-preview/*.html (browser-renderable previews for dashboard, preferences, library, reader)
# pos: documentation tool generating browser preview pages from live XHTML sources without user data

"""Generate browser previews from the actual Zotero UI sources (no user data)."""
from pathlib import Path
import re
import xml.etree.ElementTree as ET

base = Path(__file__).resolve().parents[1]
src = base / 'plugin_src/chrome/content'
out = base / 'docs/ui-preview'
out.mkdir(exist_ok=True)
for name in ('dashboard', 'preferences', 'library'):
    raw = (src / f'{name}.xhtml').read_text(encoding='utf-8')
    ET.fromstring(raw)
    raw = re.sub(r'<\?.*?\?>', '', raw)
    raw = re.sub(r'<script[^>]*/>', '', raw)
    raw = raw.replace('html:', '')
    raw = re.sub(r'\s+xmlns(?::\w+)?="[^"]*"', '', raw)
    raw = re.sub(r'<(/?)(window|vbox|groupbox)\b', r'<\1div', raw)
    raw = raw.replace('正在读取所选条目…', 'Attention Is All You Need · 示例文献')
    raw = raw.replace('id="llmSlot"', 'id="llmSlot"').replace('aria-label="模型配置列表"></select>', 'aria-label="模型配置列表"><option selected>论文精读 · DeepSeek</option><option>方法分析 · OpenAI</option></select>')
    raw = raw.replace('id="si-task-active-list" class="si-task-list" aria-live="polite"></div>', 'id="si-task-active-list" class="si-task-list" aria-live="polite"><span class="si-task-empty">当前没有进行中的总结任务。</span></div>')
    raw = raw.replace('id="si-task-history-list" class="si-task-list"></div>', 'id="si-task-history-list" class="si-task-list"><div class="si-task-row" data-status="completed"><strong>Attention Is All You Need</strong><small>已完成并保存笔记 · 文献总结 · 示例任务</small></div></div>')
    (out / f'{name}.html').write_text('<!doctype html><meta charset="utf-8"><style>body{margin:0}div.mineru-pref-container{display:block}#zotero-prefpane-mineru{box-sizing:border-box}.mineru-pref-group{display:block;box-sizing:border-box}</style>'+raw, encoding='utf-8')

raw = (src / 'scripts/reader_chat.js').read_text(encoding='utf-8')
css = re.search(r'style.textContent = `([\s\S]*?)`;', raw)[1].replace('\\\\', '\\')
(out / 'reader.html').write_text('''<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#f6f8fb}.mineru-chat{max-width:380px;margin:20px auto}'''+css+'''</style>
<div class="mineru-chat"><h2 class="mineru-chat-heading">文献研读</h2><div class="mineru-chat-intro">基于当前 PDF 提问。发送内容包括相关正文摘录和最近对话。</div><select aria-label="模型配置"><option>论文精读 · deepseek-flash</option></select><div class="mineru-chat-toolbar"><button>总结论文</button><button>解释方法</button><button>找局限性</button><button>提炼结论</button><button>自定义提示词</button></div><div class="mineru-chat-log"></div><textarea placeholder="询问研究问题、方法、结果，或输入自己的问题…"></textarea><div class="mineru-chat-toolbar"><button class="mineru-chat-send">发送问题</button><button disabled>保存对话到文献笔记</button><button>清空对话</button><button>模型设置</button></div><div class="mineru-chat-status"></div></div>''', encoding='utf-8')
print('Validated XHTML; generated previews in', out)
