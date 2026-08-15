# dsh-plugin-stack-curator

[中文](./README.zh-CN.md)

> Recommend DeepSeek Harness ("dsh") plugins for *you* — by role or by natural-language need — and curate your own personalized local plugin stack. Solves plugin-choice paralysis in a market of 595+ plugins.

Data source: [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) (parsed snapshot in `data/plugins.js`, 595 plugins / 12 categories).

## Install

```bash
dsh plugin --profile web add /abs/path/to/dsh-plugin-stack-curator
# restart the web service, then talk to it at http://127.0.0.1:3080/
```

The harness auto-routes to the two tools below by intent — no tool name needed.

## Tools

### `recommend_stack`

| param | required | notes |
|---|---|---|
| `role` | no | `developer` / `teacher` / `designer` / `writer` / `marketing` / `product_manager` / `student` / `support` (Chinese labels accepted) |
| `description` | no | natural-language need, used for keyword reranking |
| `maxResults` | no | default 8 |

Returns a curated list with `installCmd`, `oneLiner`, and `why`.

### `manage_stack`

| param | required | notes |
|---|---|---|
| `action` | yes | `list` / `add` / `remove` / `install` / `refresh_snapshot` |
| `plugins` | no | slug array for `add`/`remove` |
| `confirm` | no | `install` only runs `dsh plugin add` when `true` |
| `profile` | no | default `web` |

Persists to `~/.dsh/stack-curator/stack.json`.

## Try it (in the 3080 chat box)

- "I'm a teacher, recommend plugins for lesson prep and explanation."
- "I do marketing growth, post to social media, need multilingual content."
- "I write long-form docs and need citation + memory — pick plugins for me."
- "Add the first 3 of the teacher recommendations to my stack."
- "Install my stack to the web profile (confirm)."

## Example output

```
根据你的描述「我需要做营销增长，要发到社媒、做多语言」推荐 6 个插件：

1. [THEWOLFWALKER/dsh-notifier] — Unified notification for DSH: 25+ channels (Telegram/Feishu/WeCom/...).
2. [ShiXiangYu2/dsh-translate-pro] — Professional translation for DSH: 18 target languages.
...
```

## Develop

```bash
node --check index.js
node test.mjs                 # 9 unit tests
node examples/run.mjs         # 4 sample scenarios
node scripts/refresh-snap.mjs # refresh the plugin snapshot
```

## Files

```
dsh-plugin-stack-curator/
├── index.js                 # registers recommend_stack + manage_stack
├── stack-curator-core.js    # pure logic: parse / recommend / stack store
├── data/plugins.js          # ESM snapshot of awesome-dsh-plugin (595 plugins)
├── data/roles.js            # 8 role presets
├── scripts/refresh-snap.mjs # regenerate the snapshot from raw README
├── test.mjs
└── examples/run.mjs         # runnable demo
```

## License

MIT — use freely, audit before installing third-party plugins.
