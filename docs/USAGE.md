# 使用说明 · dsh-plugin-stack-curator

一个帮你「从 595 个 dsh 插件里挑出最适合你的那几个」的策展插件：按职业角色或自然语言描述推荐，并把选中的插件沉淀成你自己的本地插件栈。

数据来源：[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)（已解析为 `data/plugins.js` 快照，共 595 个插件 / 12 个分类）。

---

## 1. 安装 / 注册

```bash
# 注册到 web profile（http://127.0.0.1:3080/ 背后）
dsh plugin --profile web add /abs/path/to/dsh-plugin-stack-curator
# 重启 web 服务后生效
```

注册与重启后，在 3080 网页对话框里**直接说话**即可，harness 会根据意图自动调用下面两个工具，无需手动指定工具名。

---

## 2. 两个工具

- `recommend_stack` — 推荐插件（按角色 / 描述）
- `manage_stack` — 管理「我的插件栈」（`~/.dsh/stack-curator/stack.json`）

---

## 3. 复制即用的触发 prompt（在 3080 对话框里直接发）

**A. 按角色推荐（教师）**
> 我是教师，给我推荐几个适合备课和讲解的插件。

**B. 按描述推荐（营销增长）**
> 我需要做营销增长，要发到社媒、做多语言内容，推荐些插件。

**C. 角色 + 描述（开发者 + 画图）**
> 我是开发者，经常要画流程图和架构图，帮我挑插件。

**D. 纯描述（长文写作）**
> 我常写长文，需要引用资料和跨会话记忆，帮我挑插件。

**E. 管理：把推荐结果加入我的栈**
> 把我刚才看到的 teacher 推荐里前 3 个加进我的插件栈。

**F. 管理：查看 / 一键安装我的栈**
> 查看我的插件栈。
> 把我栈里的插件一键安装到 web profile（确认后执行）。

**G. 刷新快照**
> 重新拉取 awesome-dsh-plugin 列表，更新插件快照。

---

## 4. 真实输出示例（来自 `node examples/run.mjs`）

**场景 A · 按角色「教师」**

```
为你（角色预设「教师」）精选 8 个插件：

1. [hanzhangzzz/dsh-diagram] — Editable Excalidraw diagrams for DeepSeek Harness conversations.
   安装：dsh plugin --profile web add https://github.com/hanzhangzzz/dsh-diagram
2. [AKS1st/dsh-mermaid] — Render Mermaid code fences in DSH Web chat messages as SVG diagrams.
3. [Nagi-ovo/dsh-visualize] — In-conversation generative UI: interactive HTML cards into the chat stream.
4. [omdsh-dev/dsh-genui] — Interactive UI components rendered inline in replies.
5. [1624318455/dsh-plugin-tts] — Reads assistant replies aloud via free Edge TTS.
6. [NewDaNew/dsh-voice-input] — Voice input for the web UI.
7. [omdsh-dev/dsh-annotation] — Select text → annotate → send with your message.
8. [dingyi222666/dsh-focus-chat] — A "focus chat" minimal view that shows only final outputs.
```

**场景 B · 描述「营销增长 / 社媒 / 多语言」**

```
根据你的描述「我需要做营销增长，要发到社媒、做多语言」推荐 6 个插件：

1. [THEWOLFWALKER/dsh-notifier] — Unified notification for DSH: 25+ channels (Telegram/Feishu/WeCom/...).
2. [whyihaveyou/dsh-suite#plugin-notify] — IM webhook and local notifications (Feishu/WeCom/DingTalk/...).
3. [ThreeBody6666/dsh-im-hub] — Multi-platform IM gateway: Feishu/WeCom/Telegram.
4. [yangyongzhen/dsh-notify] — Task-completion notifications via ServerChan/DingTalk/Feishu/webhooks.
5. [ShiXiangYu2/dsh-translate-pro] — Professional translation for DSH: 18 target languages.
6. [superdesigndev/treg] — Tool catalog: search ~2,600 external endpoints (SEO/social/ad libraries...).
```

**场景 D · 描述「长文写作 / 引用资料 / 记忆」**

```
根据你的描述「我常写长文，需要引用资料和记忆」推荐 6 个插件：

1. [omdsh-dev/dsh-mnemon] — Cross-agent, local-first persistent memory plugin.
2. [ICCuse/dsh-file-memory] — File-backed working memory: memorize/recall key premises.
3. [LoserFox/distill] — Automatic conversation distillation.
4. [modusensus/dsh-mneme#dsh-mneme] — Cross-session memory: SQLite + Markdown mirror.
5. [nowledge-co/nowledge-mem-deepseek-harness] — One memory layer for every AI tool and agent.
6. [Jesse-njx/dsh-memory] — Cited memory over DSH's lossless session log.
```

---

## 5. 本地自检

```bash
node test.mjs              # 单元测试（9 个用例）
node examples/run.mjs      # 跑内置 4 个示例场景
node examples/run.mjs "我要画流程图和架构图"   # 自定义一句描述试推荐
```

> 说明：awesome 列表的插件描述是英文，而用户多用中文描述需求，因此核心里内置了一张「中文意图词 → 英文关键词」的同义词表（`SYNONYMS`），让中文描述也能命中。若某次推荐不准，可在描述里补充更具体的英文关键词，或直接用 `role` 走预设基线。
