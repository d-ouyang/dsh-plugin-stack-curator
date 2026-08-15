// stack-curator-core.js — pure, dependency-free domain logic.
// No imports beyond node:* so it stays unit-testable and reusable.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

// ---- 数据解析：把 awesome-dsh-plugin 的 README 解析成结构化插件列表 ----

const CATEGORY_ORDER = [
  'UI Enhancements',
  'Themes & Appearance',
  'Models & Providers',
  'Sessions & Messages',
  'Memory',
  'Tools & Capabilities',
  'Skills',
  'Workflow & Automation',
  'Notifications & Integrations',
  'Development & Runtime',
  'Plugin Markets & Managers',
  'Just for Fun',
]

function splitSlug(slug) {
  const i = slug.indexOf('/')
  if (i < 0) return [null, slug]
  return [slug.slice(0, i), slug.slice(i + 1)]
}

/**
 * Parse the awesome-dsh-plugin README markdown into a flat plugin list.
 * @param {string} md raw markdown
 * @returns {Array<{category,author,repo,name,url,description,installCmd}>}
 */
export function parseReadme(md) {
  const lines = md.split(/\r?\n/)
  const plugins = []
  let inPlugins = false
  let category = null
  const headerRe = /^##\s+Plugins\s*$/
  const subRe = /^###\s+(.+?)\s*$/
  const entryRe = /^\s*-\s+\[([^\]]+)\]\((https?:\/\/github\.com\/[^\s)]+)\)\s*-\s*(.*)$/

  for (const line of lines) {
    if (headerRe.test(line)) { inPlugins = true; continue }
    // 遇到下一个二级标题即结束 Plugins 区段
    if (inPlugins && /^##\s+/.test(line) && !headerRe.test(line)) break
    if (!inPlugins) continue

    const sub = subRe.exec(line)
    if (sub) { category = sub[1].trim(); continue }

    const m = entryRe.exec(line)
    if (m && category) {
      const slug = m[1].trim()
      const url = m[2].trim()
      let desc = m[3].trim()
      // 去掉行尾可能出现的分类标签，如 " - [UI Enhancements]"
      desc = desc.replace(/\s*-\s*\[[^\]]+\]\s*$/, '').trim()
      const [author, repo] = splitSlug(slug)
      if (!author || !repo) continue
      plugins.push({
        category,
        author,
        repo,
        name: slug,
        url,
        description: desc,
        installCmd: `dsh plugin --profile web add ${url}`,
      })
    }
  }
  return plugins
}

/** 从插件列表中按 slug（author/repo 或 repo）查找 */
export function findPlugin(plugins, slug) {
  return plugins.find(
    (p) => p.name === slug || `${p.author}/${p.repo}` === slug || p.repo === slug,
  )
}

// ---- 推荐引擎 ----

/** 把用户传入的 role 归一化到 ROLES 的 key（支持 key / label / 中文） */
export function normalizeRole(role, roles) {
  if (!role || !roles) return null
  const r = String(role).trim().toLowerCase()
  for (const key of Object.keys(roles)) {
    if (key.toLowerCase() === r) return key
    const v = roles[key]
    if (v && v.label && (v.label.toLowerCase() === r || v.label === role)) return key
  }
  return null
}

export function tokenize(s) {
  return (s || '')
    .toLowerCase()
    .split(/[^a-z0-9一-龥]+/)
    .filter(Boolean)
}

// 中文意图词 -> 英文关键词（awesome 列表描述是英文，需做意图桥接）
const SYNONYMS = {
  营销: ['marketing', 'social', 'growth', 'telegram', 'wechat', 'feishu', 'notify', 'promote'],
  增长: ['marketing', 'growth', 'social'],
  社媒: ['telegram', 'wechat', 'feishu', 'notify', 'social'],
  推广: ['marketing', 'social', 'notify'],
  写作: ['writing', 'document', 'paper', 'novel', 'compose'],
  长文: ['writing', 'document', 'novel'],
  文档: ['writing', 'document', 'paper'],
  画: ['diagram', 'mermaid', 'excalidraw', 'visual', 'graph', 'draw'],
  流程图: ['diagram', 'mermaid', 'flow', 'excalidraw'],
  架构图: ['diagram', 'graph', 'mermaid', 'visual'],
  示意图: ['diagram', 'mermaid', 'visual'],
  图: ['diagram', 'graph', 'visual', 'mermaid'],
  记忆: ['memory', 'distill', 'mneme', 'note', 'recall'],
  复盘: ['memory', 'distill', 'note'],
  笔记: ['note', 'memory', 'annotat'],
  语音: ['tts', 'voice', 'speech'],
  朗读: ['tts', 'voice', 'speech'],
  听: ['tts', 'voice', 'speech'],
  翻译: ['translate', 'translation', 'language'],
  多语言: ['translate', 'translation', 'language'],
  教师: ['teach', 'diagram', 'visual', 'mermaid', 'tts', 'annotat'],
  教学: ['teach', 'diagram', 'visual'],
  备课: ['teach', 'diagram', 'visual'],
  讲解: ['teach', 'diagram', 'visual', 'tts'],
  设计: ['theme', 'skin', 'design', 'pencil', 'diagram', 'visual'],
  美化: ['theme', 'skin', 'design'],
  主题: ['theme', 'skin'],
  开发: ['git', 'code', 'dev', 'runtime', 'worktree'],
  代码: ['git', 'code', 'dev', 'runtime'],
  客服: ['notify', 'wechat', 'telegram', 'feishu', 'voice', 'support'],
  接待: ['notify', 'wechat', 'telegram', 'feishu', 'voice'],
  任务: ['task', 'plan', 'workflow', 'schedule'],
  规划: ['plan', 'task', 'workflow', 'dag'],
  排期: ['schedule', 'task', 'plan'],
  搜索: ['search', 'find'],
  查找: ['search', 'find'],
  通知: ['notify', 'notification', 'bark', 'ring'],
  提醒: ['notify', 'notification', 'reminder', 'bark'],
}

/** 把 token 列表展开（中文意图词桥接为英文关键词），用于跨语言匹配。
 *  中文无空格，整句会成一个 token，因此用「子串包含」匹配同义词键。 */
export function expandTokens(tokens) {
  const keys = Object.keys(SYNONYMS)
  const out = []
  for (const t of tokens) {
    out.push(t)
    if (!/[一-龥]/.test(t)) continue
    for (const k of keys) {
      if (t.includes(k)) out.push(...SYNONYMS[k])
    }
  }
  return out
}

export function scorePlugin(p, tokens) {
  if (!tokens.length) return 0
  const hay = `${p.description} ${p.category} ${p.name} ${p.repo}`.toLowerCase()
  let s = 0
  for (const t of tokens) if (hay.includes(t)) s += 1
  return s
}

function whyFor(p, roleUsed, description) {
  if (roleUsed) return `属于「${roleUsed}」预设精选，贴合该角色的典型工作流`
  if (description) return `与你的描述关键词匹配（${p.category}）`
  return `来自全量列表的匹配结果`
}

function summarize(role, roleLabel, query, results) {
  const head = role
    ? `为你（角色预设「${roleLabel || role}」）精选 ${results.length} 个插件：`
    : query
      ? `根据你的描述「${query}」推荐 ${results.length} 个插件：`
      : `为你推荐 ${results.length} 个插件：`
  const body = results
    .map(
      (r, i) =>
        `${i + 1}. [${r.name}](${r.url}) — ${r.oneLiner}\n   安装：${r.installCmd}`,
    )
    .join('\n')
  return `${head}\n\n${body}`
}

/**
 * 推荐核心。role 提供强基线，description 用于关键词精排/补充。
 * @returns {{role:?string, query:?string, results:Array, summary:string}}
 */
export function recommend({ role, description, plugins, roles, maxResults = 8 }) {
  let base = []
  let roleUsed = null
  const roleKey = normalizeRole(role, roles)
  if (roleKey && roles && roles[roleKey]) {
    roleUsed = roleKey
    const want = roles[roleKey].plugins || []
    base = want.map((slug) => findPlugin(plugins, slug)).filter(Boolean)
  }
  const tokens = expandTokens(tokenize(description || ''))
  let scored
  if (base.length && tokens.length) {
    const others = plugins.filter((p) => !base.includes(p))
    const rankedBase = base
      .map((p) => ({ p, s: scorePlugin(p, tokens) }))
      .sort((a, b) => b.s - a.s)
    const extra = others
      .map((p) => ({ p, s: scorePlugin(p, tokens) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, maxResults)
    scored = [...rankedBase, ...extra].slice(0, maxResults)
  } else if (base.length) {
    scored = base.map((p) => ({ p, s: 1 }))
  } else {
    scored = plugins
      .map((p) => ({ p, s: scorePlugin(p, tokens) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, maxResults)
  }

  const roleLabel = roleUsed && roles[roleUsed] ? roles[roleUsed].label : roleUsed

  const results = scored.map(({ p, s }) => ({
    category: p.category,
    name: p.name,
    author: p.author,
    repo: p.repo,
    url: p.url,
    installCmd: p.installCmd,
    oneLiner: p.description,
    score: s,
    why: whyFor(p, roleUsed, description),
  }))

  const summary = summarize(roleUsed, roleLabel, description, results)
  return { role: roleUsed, query: description || null, results, summary }
}

// ---- 个人插件栈持久化（~/.dsh/stack-curator/stack.json）----

export function stackDir() {
  return join(homedir(), '.dsh', 'stack-curator')
}
export function stackFile() {
  return join(stackDir(), 'stack.json')
}

export async function readStack() {
  try {
    return JSON.parse(await readFile(stackFile(), 'utf8'))
  } catch {
    return { plugins: [] }
  }
}

export async function writeStack(stack) {
  await mkdir(stackDir(), { recursive: true })
  await writeFile(stackFile(), JSON.stringify(stack, null, 2))
}

export async function addToStack(slugs, plugins) {
  const stack = await readStack()
  const have = new Set(stack.plugins.map((p) => p.name))
  const added = []
  for (const slug of slugs) {
    const p = findPlugin(plugins, slug)
    if (p && !have.has(p.name)) {
      stack.plugins.push({ name: p.name, url: p.url, installCmd: p.installCmd })
      added.push(p.name)
    }
  }
  await writeStack(stack)
  return { stack, added }
}

export async function removeFromStack(slugs) {
  const stack = await readStack()
  const remove = new Set(slugs)
  const before = stack.plugins.length
  stack.plugins = stack.plugins.filter(
    (p) => !remove.has(p.name) && !remove.has(p.url),
  )
  await writeStack(stack)
  return { stack, removed: before - stack.plugins.length }
}

export function buildInstallCommands(stack) {
  return stack.plugins.map((p) => p.installCmd)
}

export function formatStack(stack, plugins) {
  if (!stack.plugins.length) return '我的插件栈为空。用 add 加入推荐结果，或用 install 一键安装。'
  const lines = stack.plugins.map((p, i) => {
    const meta = findPlugin(plugins, p.name)
    const desc = meta ? meta.description : ''
    return `${i + 1}. [${p.name}](${p.url}) — ${desc}\n   安装：${p.installCmd}`
  })
  return `我的插件栈（共 ${stack.plugins.length} 个）：\n\n${lines.join('\n')}`
}

export { CATEGORY_ORDER }
