# 使用说明 · dsh-plugin-stack-curator

一个帮你「从 595 个 dsh 插件里挑出最适合你的那几个」的策展插件：按职业角色或自然语言描述推荐，并把选中的插件沉淀成你自己的本地插件栈。

数据来源：[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 的**官方公开注册表** `https://awesome-dsh-plugin.com/plugins.json`（共 595 个插件 / 12 个分类）。该注册表由 awesome 项目自己的 `build-site.mjs` 基于 README（真相源）生成、并经 probe 脚本富集（npm 名、GitHub star 等）。插件内已内置一份快照作为离线兜底；可随时用 `update_catalog` 拉取最新。

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
- `manage_stack` — 管理「我的插件栈」（`~/.dsh/stack-curator/stack.json`）；`update_catalog` 则负责刷新插件目录（缓存到 `~/.dsh/stack-curator/catalog.json`）

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

**G. 更新插件目录**
> 更新一下插件目录。（→ 调用 `manage_stack({action:"update_catalog"})`，从 awesome 官方注册表拉取最新列表，缓存到 `~/.dsh/stack-curator/catalog.json`）

---

## 4. 真实输出示例（来自 `node examples/run.mjs`）

**场景 A · 按角色「教师」**

```
为你（角色预设「教师」）精选 8 个插件：

1. [dsh-diagram](https://github.com/hanzhangzzz/dsh-diagram) — DeepSeek Harness 会话中的可编辑 Excalidraw 图表。 （⭐2）
   安装：dsh plugin --profile web add dsh-diagram
2. [dsh-mermaid](https://github.com/AKS1st/dsh-mermaid) — 把 DSH Web 会话消息中的 Mermaid 代码围栏渲染为惰性加载的 SVG 图表。 （⭐2）
3. [dsh-visualize](https://github.com/Nagi-ovo/dsh-visualize) — 对话内生成式 UI：模型把交互式 HTML 卡片直接画进会话流。 （⭐95）
4. [dsh-genui](https://github.com/omdsh-dev/dsh-genui) — 助手回复内渲染交互式 UI 组件。 （⭐88）
5. [dsh-plugin-tts](https://github.com/1624318455/dsh-plugin-tts) — 用免费 Edge TTS 朗读 AI 回复。 （⭐1）
6. [dsh-voice-input](https://github.com/NewDaNew/dsh-voice-input) — Web UI 语音输入。 （⭐0）
7. [dsh-annotation](https://github.com/omdsh-dev/dsh-annotation) — 选中文字→批注→随消息发送。 （⭐46）
8. [dsh-focus-chat](https://github.com/dingyi222666/dsh-focus-chat) — 「聚焦会话」精简视图。 （⭐16）
```

**场景 B · 描述「营销增长 / 社媒 / 多语言」**

```
根据你的描述「我需要做营销增长，要发到社媒、做多语言」推荐 6 个插件：

1. [dsh-notifier](https://github.com/THEWOLFWALKER/dsh-notifier) — 统一通知推送：一个 notify() API 打通 25+ 渠道（Telegram/飞书/企微/...）。 （⭐0）
   安装：dsh plugin --profile web add dsh-notifier
2. [dsh-im-hub](https://github.com/ThreeBody6666/dsh-im-hub) — 多平台 IM 网关：飞书/企微/Telegram。 （⭐2）
3. [dsh-suite#plugin-notify](https://github.com/whyihaveyou/dsh-suite/tree/main/packages/plugins/plugin-notify) — 回合完成/错误/待审批时推送 IM webhook。 （⭐21）
4. [dsh-lark-bridge](https://github.com/imetn/dsh-lark-bridge) — DeepSeek Harness 的飞书/Lark 双向控制器。 （⭐7）
5. [telegram](https://github.com/LoserFox/telegram) — Telegram Bot API 桥接。 （⭐6）
6. [dsh-lark-meeting-notifier](https://github.com/yeruizhi/dsh-lark-meeting-notifier) — 飞书会议提醒。 （⭐6）
```

**场景 D · 描述「长文写作 / 引用资料 / 记忆」**

```
根据你的描述「我常写长文，需要引用资料和跨会话记忆，帮我挑插件」推荐 6 个插件：

1. [dsh-mnemon](https://github.com/omdsh-dev/dsh-mnemon) — 跨 Agent、本地优先的持久记忆插件。 （⭐23）
2. [dsh-file-memory](https://github.com/ICCuse/dsh-file-memory) — 文件型工作记忆。 （⭐0）
3. [distill](https://github.com/LoserFox/distill) — 自动对话蒸馏。 （⭐16）
4. [dsh-mneme#dsh-mneme](https://github.com/modusensus/dsh-mneme/tree/main/dsh-mneme) — 跨会话记忆：SQLite + Markdown 镜像。 （⭐9）
5. [dsh-auto-memory](https://github.com/Aik358/dsh-auto-memory) — DSH 自动记忆插件：三层记忆自动注入与检索。 （⭐6）
```

---

## 5. 本地自检

```bash
node test.mjs              # 单元测试（9 个用例）
node examples/run.mjs      # 跑内置 4 个示例场景
node examples/run.mjs "我要画流程图和架构图"   # 自定义一句描述试推荐
node scripts/refresh-catalog.mjs   # 从官方注册表刷新插件目录
```

> 说明：awesome 列表的插件描述虽为英文，但官方注册表同时提供了中文 `description.zh` 字段，本插件优先展示中文；再用内置「中文意图词 → 英文关键词」同义词表（`SYNONYMS`）做跨语言匹配，让中文描述也能命中。若某次推荐不准，可在描述里补充更具体的英文关键词，或直接用 `role` 走预设基线。
