# dsh-plugin-stack-curator（中文）

[English](./README.md)

> 为 DeepSeek Harness（dsh）用户「按角色 / 需求推荐插件」，并管理你自己的个性化本地插件栈。解决插件市场繁荣后的「选择困难症」——在 595+ 个插件里帮你挑出最适合的那几个。

数据来源：[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 的**官方公开注册表** `https://awesome-dsh-plugin.com/plugins.json`（共 595 个插件 / 12 个分类）。该注册表由 awesome 项目自己的 `build-site.mjs` 基于 README（真相源）生成、并经 probe 脚本富集（npm 名、GitHub star 等）。`recommend_stack` 直接消费它；仓库内同时内置一份快照作为离线兜底。用 `manage_stack({action:"update_catalog"})`（或 `node scripts/refresh-catalog.mjs`）即可拉取最新列表。

## 一键安装

```bash
dsh plugin --profile web add /abs/path/to/dsh-plugin-stack-curator
# 重启 web 服务后，在 http://127.0.0.1:3080/ 直接对话即可触发
```

harness 会按意图自动路由到下方两个工具，无需手动指定工具名。

## 两个工具

### `recommend_stack`（推荐）

| 参数 | 必填 | 说明 |
|---|---|---|
| `role` | 否 | `developer` / `teacher` / `designer` / `writer` / `marketing` / `product_manager` / `student` / `support`（也接受中文标签，如「教师」） |
| `description` | 否 | 自然语言描述需求，用于关键词精排 |
| `maxResults` | 否 | 默认 8 |

返回带 `installCmd`、`oneLiner`（优先中文）、`stars`、`why` 的精选清单。

### `manage_stack`（管理我的栈）

| 参数 | 必填 | 说明 |
|---|---|---|
| `action` | 是 | `list` / `add` / `remove` / `install` / `update_catalog`（`refresh_snapshot` 作为兼容别名保留） |
| `plugins` | 否 | `add`/`remove` 时的插件 slug 数组 |
| `confirm` | 否 | `install` 需为 `true` 才真正执行 `dsh plugin add` |
| `profile` | 否 | 默认 `web` |

持久化于 `~/.dsh/stack-curator/stack.json`。`update_catalog` 会从官方注册表（失败则回退 raw README）刷新插件目录并缓存到 `~/.dsh/stack-curator/catalog.json`；此后 `recommend_stack` 自动使用最新副本。

## 试试看（在 3080 对话框里直接说）

- 「我是教师，给我推荐几个适合备课和讲解的插件。」
- 「更新一下插件目录。」 ← 触发 `update_catalog`
- 「我需要做营销增长，要发到社媒、做多语言内容，推荐些插件。」
- 「我常写长文，需要引用资料和跨会话记忆，帮我挑插件。」
- 「把我刚才看到的 teacher 推荐里前 3 个加进我的插件栈。」
- 「把我栈里的插件一键安装到 web profile（确认后执行）。」

## 示例输出

```
根据你的描述「我需要做营销增长，要发到社媒、做多语言」推荐 6 个插件：

1. [dsh-notifier](https://github.com/THEWOLFWALKER/dsh-notifier) — 统一通知推送：一个 notify() API 打通 25+ 渠道（Telegram/飞书/企微/...）。 （⭐0）
   安装：dsh plugin --profile web add dsh-notifier
2. [dsh-im-hub](https://github.com/ThreeBody6666/dsh-im-hub) — 多平台 IM 网关：飞书/企微/Telegram。 （⭐2）
...
```

## 更新插件目录

目录来自 awesome 的官方注册表，两种等价方式刷新：

```bash
# A) 对话内工具（说「更新插件目录」「刷新插件列表」会自动路由）
manage_stack({ action: "update_catalog" })

# B) 命令行
node scripts/refresh-catalog.mjs
```

结果缓存于 `~/.dsh/stack-curator/catalog.json`；`recommend_stack` 每次调用都优先读它（缓存缺失时回退内置快照）。

## 本地开发

```bash
node --check index.js
node test.mjs                 # 9 个单元测试
node examples/run.mjs         # 4 个示例场景
node scripts/refresh-catalog.mjs # 从官方注册表刷新插件目录
```

## 文件结构

```
dsh-plugin-stack-curator/
├── index.js                 # 注册 recommend_stack + manage_stack
├── stack-curator-core.js    # 纯逻辑：目录拉取/归一化 / 推荐 / 栈存储
├── data/plugins.js          # awesome 注册表的内置快照（595 插件，离线兜底）
├── data/roles.js            # 8 个角色预设
├── scripts/refresh-catalog.mjs # 从 awesome-dsh-plugin.com/plugins.json 更新目录
├── test.mjs
└── examples/run.mjs         # 可运行演示
```

运行时最新的目录会缓存到 `~/.dsh/stack-curator/catalog.json`。

## 许可

MIT —— 自由使用，安装第三方插件前请自行审阅源码。
