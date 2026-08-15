# dsh-plugin-stack-curator 技术文档

> 一个为 DeepSeek Harness（dsh）用户「按角色 / 需求推荐插件并管理个人插件栈」的策展插件。
> 解决痛点：插件市场越来越繁荣后，大部分人面对海量插件有「选择困难症」，不清楚自己需要什么；本插件把「别人帮我挑」变成「按我的职业/工作自动挑」，并沉淀成高度个性化的本地插件库。

---

## 0. 插件目录的数据来源（关键设计）

本插件不直接假定某一版列表，而是消费 **awesome-dsh-plugin 项目的官方公开注册表**：

- 真相源（source of truth）：awesome 仓库各语言 README 里的 bullet 条目 `- [author/repo](github-url) - 描述`。
- 维护流程：`build-site.mjs` 解析 README → 调用 `probe-npm` / `probe-readmes` / `probe-stars` 等脚本抓取 npm 名、README 正文、GitHub star 等富集信息 → 生成站点与**公开注册表 API `/plugins.json`**（脚本注释明写 *"Public registry API: /plugins.json — deterministic; consumed by the find plugin"*）。
- 因此本插件**优先拉取 `https://awesome-dsh-plugin.com/plugins.json`**，这正是 awesome 项目希望外部程序消费的标准数据源；仅在注册表不可达时回退到 raw README 解析（离线兜底）。

注册表条目字段（归一化后）：`name`(短名) / `author`(owner) / `repo`(owner/name) / `url` / `page` / `category` / `description`(en) / `descriptionZh`(zh) / `npm` / `stars` / `install`(官方安装命令) / `added`(加入日期)。

---

## 1. 用途与解决的苦力

- **插件选择困难症**：awesome-dsh-plugin 列表已有 595 个插件、12 个分类，逐个看不现实。
- **角色化推荐**：营销 / 教师 / 设计师 / 写作者 / 开发者 / 产品经理 / 学生 / 客服 等职业，各有典型工作流，直接给精选清单。
- **自然语言兜底**：不清楚自己算什么角色时，用一句中文描述（"我要做营销增长""我常写长文"）也能推荐。
- **个人插件栈**：把挑中的插件持久化到 `~/.dsh/stack-curator/stack.json`，可一键安装、可随时增删，形成「我的栈」。

---

## 2. 工具签名

### 2.1 `recommend_stack`

| 参数 | 必填 | 说明 |
|---|---|---|
| `role` | 否 | 职业角色预设：`developer` / `teacher` / `designer` / `writer` / `marketing` / `product_manager` / `student` / `support`（也接受中文标签，如「教师」） |
| `description` | 否 | 自然语言描述你的工作 / 需求，用于关键词精排与补充 |
| `maxResults` | 否 | 返回最大插件数（默认 8） |

**输出 schema**：

```json
{
  "role": "string|null",
  "query": "string|null",
  "results": [
    {
      "name": "author/repo",
      "category": "UI Enhancements",
      "url": "https://github.com/author/repo",
      "installCmd": "dsh plugin --profile web add github:author/repo",
      "oneLiner": "插件一句话简介（优先中文）",
      "stars": 95,
      "why": "推荐理由"
    }
  ],
  "summary": "可读文本，逐条列出 name/url/installCmd"
}
```

**语义**：`role` 提供强基线（该角色预设的 6–8 个插件）；`description` 用于关键词精排并在基线之外补充命中项。两者都给时，role 优先、description 用于加减与排序。

### 2.2 `manage_stack`

| 参数 | 必填 | 说明 |
|---|---|---|
| `action` | 是 | `list` / `add` / `remove` / `install` / `update_catalog`（`refresh_snapshot` 作为兼容别名保留） |
| `plugins` | 否 | `add`/`remove` 时的插件 slug 数组，如 `["author/repo"]` |
| `confirm` | 否 | `install` 时为 `true` 才真正执行 `dsh plugin add`（默认 false，只返回命令） |
| `profile` | 否 | `install` 使用的 profile（默认 `web`） |

**输出 schema**：`{ action, summary, commands[], installed[], failed[] }`。

- `list`：读取并打印「我的栈」。
- `add`：把给定 slug 加入栈（去重），持久化。
- `remove`：从栈移除给定 slug。
- `install`：`confirm=true` 时对每个栈内插件执行 `dsh plugin --profile <p> add <url>`；失败项单独列出。**安装后需重启 3080 才能加载新插件**。
- `update_catalog`：调用 `updateCatalog()` 从官方注册表（失败回退 raw README）拉取最新插件目录，写入 `~/.dsh/stack-curator/catalog.json`；之后 `recommend_stack` 自动使用新目录。无网络时返回手动命令提示。

---

## 3. 核心算法（stack-curator-core.js）

纯函数、无第三方依赖（仅 `node:*`），便于单元测试与复用。

- **`fetchRegistry()` / `normalizeRegistry(doc)`**：拉取并归一化官方注册表。`normalizeRegistry` 把 `{owner,name,url,page,category,description:{en,zh},npm,stars,install,added}` 映射为本插件结构（含中文 `descriptionZh` 与 `stars`）。
- **`parseReadme(md)`**：README 解析兜底。以 `## Plugins` 为起点，遇下一个 `## ` 结束；`### ` 作为分类；条目正则 `^\s*-\s+\[([^\]]+)\]\((https?://github\.com/...)\)\s*-\s*(.*)$` 提取 `author/repo`、url、描述（并剥离行尾分类标签）。统一约定 `name`=短名、`repo`=owner/name。
- **`updateCatalog({onStatus})`**：优先 `fetchRegistry()`，失败回退 `parseReadme(await fetchReadmeRaw())`；结果写 `CATALOG_CACHE`（`~/.dsh/stack-curator/catalog.json`）。
- **`loadPlugins()`**：每次调用优先读 `CATALOG_CACHE`，缺失/损坏则回退内置 `data/plugins.js` 快照。这样刷新后即时生效，且生产环境只读 bundle 也能用缓存。
- **`tokenize(s)`**：按 `[^a-z0-9一-龥]+` 切分。
- **`SYNONYMS` + `expandTokens(tokens)`**：中文意图词 → 英文关键词桥接表（如 `营销→marketing/social/telegram/...`、`写作→writing/document`、`画/流程图→diagram/mermaid/...`）。因 awesome 列表英文居多，中文整句会切成无空格单 token，故用**子串包含**匹配同义词键，解决跨语言命中。
- **`scorePlugin(p, tokens)`**：在 `description + descriptionZh + category + name + repo` 上做子串包含计数（同时匹配中英文描述）。
- **`normalizeRole(role, roles)`**：把用户传入的 `role` 归一化为预设 key（兼容英文 key 与中文 label）。
- **`recommend({role, description, plugins, roles, maxResults})`**：
  1. 归一化 role → 取预设插件作为基线 `base`；
  2. `description` 经 `expandTokens` 展开后参与打分；
  3. `base` 有值且带描述：基线按描述重排 + 全量补充分数>0 的项；
  4. 仅基线 / 仅描述 / 皆无 三种分支，统一截到 `maxResults`，同分时按 `stars` 降序；附 `why` 与 `summary`。
- **栈持久化**：`readStack` / `writeStack` / `addToStack` / `removeFromStack` / `formatStack` / `buildInstallCommands`，存于 `~/.dsh/stack-curator/stack.json`。

### 数据文件

- `data/plugins.json` + `data/plugins.js`：从官方注册表快照生成的**内置兜底**数据（595 个插件）。`plugins.js` 是 ESM 模块，被 `index.js` 直接 import。
- `data/roles.js`：8 个角色预设，每个 6–8 个真实存在的插件 slug（已校验全部可解析）。
- `scripts/refresh-catalog.mjs`：命令行版刷新——调用 `updateCatalog()`，从 `awesome-dsh-plugin.com/plugins.json` 拉取并写缓存。

---

## 4. 完整功能目录

| 功能 | 触发方式 | 说明 |
|---|---|---|
| 角色推荐 | `recommend_stack({role:"teacher"})` | 返回该角色 6–8 个精选插件 |
| 描述推荐 | `recommend_stack({description:"营销增长"})` | 中文意图经 SYNONYMS 桥接英文后命中 |
| 角色+描述 | 两者同给 | 角色基线 + 描述精排/补充 |
| 查看我的栈 | `manage_stack({action:"list"})` | 读取 stack.json |
| 加入栈 | `manage_stack({action:"add",plugins:[...]})` | 去重持久化 |
| 移除栈 | `manage_stack({action:"remove",plugins:[...]})` | 从栈删除 |
| 一键安装 | `manage_stack({action:"install",confirm:true})` | 逐条执行 dsh plugin add |
| 更新插件目录 | `manage_stack({action:"update_catalog"})` 或 `node scripts/refresh-catalog.mjs` | 从官方注册表拉取最新，缓存到 catalog.json |

---

## 5. 示例场景与真实输出

**按角色「教师」** → 返回 `dsh-diagram`(⭐2) / `dsh-mermaid`(⭐2) / `dsh-visualize`(⭐95) / `dsh-genui`(⭐88) / `dsh-plugin-tts`(⭐1) / `dsh-voice-input`(⭐0) / `dsh-annotation`(⭐46) / `dsh-focus-chat`(⭐16)。

**描述「营销增长 / 社媒 / 多语言」** → 返回 `dsh-notifier` / `dsh-im-hub` / `dsh-suite#plugin-notify` / `dsh-lark-bridge` / `telegram` / `dsh-lark-meeting-notifier`（社媒与多语言触达类）。

**描述「长文写作 / 引用资料 / 记忆」** → 返回 `dsh-mnemon`(⭐23) / `dsh-file-memory`(⭐0) / `distill`(⭐16) / `dsh-mneme`(⭐9) / `dsh-auto-memory`(⭐6)。

（完整输出见 `docs/USAGE.md` 与 `node examples/run.mjs`。）

---

## 6. 注册命令与本地开发

```bash
# 注册到 web profile（其他人请直接用 GitHub 安装，零构建、无需 allowBuilds）
dsh plugin --profile web add github:d-ouyang/dsh-plugin-stack-curator
# 重启 3080 后，在 http://127.0.0.1:3080/ 直接说话即可触发

# 本地开发时也可装本地目录：
# git clone https://github.com/d-ouyang/dsh-plugin-stack-curator.git
# dsh plugin --profile web add ./dsh-plugin-stack-curator

# 本地校验
node --check index.js
node test.mjs           # 9 个单元测试
node examples/run.mjs   # 4 个示例场景

# 更新插件目录（从官方注册表）
node scripts/refresh-catalog.mjs                 # 联网
```

---

## 7. 设计取舍与已知限制

- **数据策略（消费官方注册表 + 缓存）**：默认提交注册表快照（离线可用、可预测），并暴露 `update_catalog` 实时从 `awesome-dsh-plugin.com/plugins.json` 刷新，结果缓存到 `~/.dsh/stack-curator/catalog.json`；`recommend_stack` 优先读缓存。比单纯解析 README 更鲁棒：字段更全（stars/npm/中文描述），且是 awesome 项目官方指定的程序消费入口。
- **推荐机制（预设 + 关键词精排）**：角色给强基线，描述做关键词精排；跨语言靠 `SYNONYMS` 桥接。若需更强语义理解，可在 harness 侧用 LLM 对返回的候选做二次解释（工具已返回 `oneLiner` 与 `why` 供 LLM 复用）。
- **不自动安装（除非确认）**：`install` 需 `confirm=true`，且执行的是官方 `dsh plugin add`，安装后需重启 web 服务。
- **列表刷新需网络**：`update_catalog` 调用官方注册表；离线时回退内置快照，不会报错中断。
- **star 数来自注册表快照**：仅作排序辅助信号，不代表实时值。
