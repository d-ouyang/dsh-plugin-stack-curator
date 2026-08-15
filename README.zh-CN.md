# dsh-plugin-stack-curator（中文）

[English](./README.md)

> 为 DeepSeek Harness（dsh）用户「按角色 / 需求推荐插件」，并管理你自己的个性化本地插件栈。解决插件市场繁荣后的「选择困难症」——在 595+ 个插件里帮你挑出最适合的那几个。

数据来源：[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)（已解析为 `data/plugins.js` 快照，共 595 个插件 / 12 个分类）。

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

返回带 `installCmd`、`oneLiner`、`why` 的精选清单。

### `manage_stack`（管理我的栈）

| 参数 | 必填 | 说明 |
|---|---|---|
| `action` | 是 | `list` / `add` / `remove` / `install` / `refresh_snapshot` |
| `plugins` | 否 | `add`/`remove` 时的插件 slug 数组 |
| `confirm` | 否 | `install` 需为 `true` 才真正执行 `dsh plugin add` |
| `profile` | 否 | 默认 `web` |

持久化于 `~/.dsh/stack-curator/stack.json`。

## 试试看（在 3080 对话框里直接说）

- 「我是教师，给我推荐几个适合备课和讲解的插件。」
- 「我需要做营销增长，要发到社媒、做多语言内容，推荐些插件。」
- 「我常写长文，需要引用资料和跨会话记忆，帮我挑插件。」
- 「把我刚才看到的 teacher 推荐里前 3 个加进我的插件栈。」
- 「把我栈里的插件一键安装到 web profile（确认后执行）。」

## 示例输出

```
根据你的描述「我需要做营销增长，要发到社媒、做多语言」推荐 6 个插件：

1. [THEWOLFWALKER/dsh-notifier] — Unified notification for DSH: 25+ channels (Telegram/Feishu/WeCom/...).
2. [ShiXiangYu2/dsh-translate-pro] — Professional translation for DSH: 18 target languages.
...
```

## 本地开发

```bash
node --check index.js
node test.mjs                 # 9 个单元测试
node examples/run.mjs         # 4 个示例场景
node scripts/refresh-snap.mjs # 刷新插件快照
```

## 文件结构

```
dsh-plugin-stack-curator/
├── index.js                 # 注册 recommend_stack + manage_stack
├── stack-curator-core.js    # 纯逻辑：解析 / 推荐 / 栈存储
├── data/plugins.js          # awesome 列表 ESM 快照（595 插件）
├── data/roles.js            # 8 个角色预设
├── scripts/refresh-snap.mjs # 从 raw README 重新生成快照
├── test.mjs
└── examples/run.mjs         # 可运行演示
```

## 许可

MIT —— 自由使用，安装第三方插件前请自行审阅源码。
