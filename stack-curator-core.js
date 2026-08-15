// stack-curator-core.js — pure, dependency-free domain logic.
// No imports beyond node:* so it stays unit-testable and reusable.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PLUGINS as BUNDLED_PLUGINS } from './data/plugins.js'

const HERE = dirname(fileURLToPath(import.meta.url))

// ---- 数据源（来自 awesome-dsh-plugin 项目的真实获取流程）----
// 真相源 = 各语言 README 的 bullet 条目；维护者跑 probe 脚本抓取 npm/stars/readme
// 富集后，build-site.mjs 生成「公开注册表 API」/plugins.json（注释明说
// "Public registry API: /plugins.json — deterministic; consumed by the find plugin"）。
// 因此本项目优先消费该社区注册表（awesome-dsh-plugin 维护），README 解析仅作离线兜底。
export const REGISTRY_URL = 'https://awesome-dsh-plugin.com/plugins.json'
export const README_RAW_URL =
  'https://raw.githubusercontent.com/awesome-dsh-plugin/awesome-dsh-plugin/main/README.md'

// 刷新后的目录缓存（用户级，不污染插件目录；生产只读 bundle 也能用）
export const CATALOG_CACHE = join(stackDir(), 'catalog.json')

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

/** 个人插件栈目录 ~/.dsh/stack-curator */
export function stackDir() {
  return join(homedir(), '.dsh', 'stack-curator')
}

// ---- 解析：把 README markdown 解析成结构化插件列表（离线兜底用）----
// 统一约定：name = 短仓库名，repo = "owner/name" 全 slug。
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
    if (inPlugins && /^##\s+/.test(line) && !headerRe.test(line)) break
    if (!inPlugins) continue

    const sub = subRe.exec(line)
    if (sub) { category = sub[1].trim(); continue }

    const m = entryRe.exec(line)
    if (m && category) {
      const slug = m[1].trim()
      const url = m[2].trim()
      let desc = m[3].trim().replace(/\s*-\s*\[[^\]]+\]\s*$/, '').trim()
      const [author, repo] = splitSlug(slug)
      if (!author || !repo) continue
      plugins.push({
        category,
        author,
        name: repo,
        repo: slug,
        url,
        description: desc,
        descriptionZh: '',
        npm: null,
        stars: null,
        installCmd: `dsh plugin --profile web add ${url}`,
        added: null,
      })
    }
  }
  return plugins
}

/** 把 awesome-dsh-plugin 社区注册表文档归一化为本项目插件结构 */
export function normalizeRegistry(doc) {
  const arr = Array.isArray(doc) ? doc : doc.plugins || []
  const out = []
  for (const p of arr) {
    if (!p || !p.name || !p.owner) continue
    const owner = p.owner
    const name = p.name
    const descObj = p.description && typeof p.description === 'object' ? p.description : null
    const en = descObj ? descObj.en || descObj.zh || '' : (p.description || '')
    const zh = descObj ? descObj.zh || descObj.en || '' : ''
    const full = `${owner}/${name}`
    out.push({
      category: p.category || 'uncategorized',
      author: owner,
      name,
      repo: full,
      url: p.url || `https://github.com/${full}`,
      page: p.page || null,
      description: en,
      descriptionZh: zh,
      npm: p.npm || null,
      stars: typeof p.stars === 'number' ? p.stars : null,
      installCmd:
        p.install || `dsh plugin --profile web add github:${full}`,
      added: p.added || null,
    })
  }
  return out
}

/** 拉取并归一化社区注册表。失败抛错，由上层回退到 README */
export async function fetchRegistry(timeoutMs = 30000) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(REGISTRY_URL, {
      signal: ac.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`registry HTTP ${res.status}`)
    const doc = await res.json()
    const list = normalizeRegistry(doc)
    if (!list.length) throw new Error('registry returned 0 plugins')
    return list
  } finally {
    clearTimeout(t)
  }
}

/**
 * 更新插件目录：优先社区注册表 API，失败回退 raw README。
 * 结果写入 CATALOG_CACHE（~/.dsh/stack-curator/catalog.json）。
 * @returns {{source:string,count:number,path:string,updated:string}}
 */
export async function updateCatalog({ onStatus } = {}) {
  let plugins
  let source
  try {
    if (onStatus) onStatus('正在从社区注册表拉取 ' + REGISTRY_URL)
    plugins = await fetchRegistry()
    source = 'registry' // awesome-dsh-plugin.com/plugins.json
  } catch (e) {
    if (onStatus) onStatus('注册表不可用（' + e.message + '），回退到 raw README')
    const md = await fetchReadmeRaw()
    plugins = parseReadme(md)
    source = 'readme' // raw.githubusercontent README（真相源）
  }
  mkdirSync(dirname(CATALOG_CACHE), { recursive: true })
  const payload = {
    source,
    updated: new Date().toISOString(),
    count: plugins.length,
    plugins,
  }
  writeFileSync(CATALOG_CACHE, JSON.stringify(payload, null, 2))
  if (onStatus) onStatus(`已更新目录：${plugins.length} 个插件（来源 ${source}）`)
  return { source, count: plugins.length, path: CATALOG_CACHE, updated: payload.updated }
}

async function fetchReadmeRaw(timeoutMs = 30000) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(README_RAW_URL, { signal: ac.signal })
    if (!res.ok) throw new Error(`README HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(t)
  }
}

/**
 * 读取当前生效的插件目录：优先 CATALOG_CACHE（update_catalog 刷新结果），
 * 否则回退到内置快照 data/plugins.js。
 */
export function loadPlugins() {
  try {
    if (existsSync(CATALOG_CACHE)) {
      const doc = JSON.parse(readFileSync(CATALOG_CACHE, 'utf8'))
      if (Array.isArray(doc.plugins) && doc.plugins.length) return doc.plugins
    }
  } catch {
    /* ignore corrupt cache */
  }
  return BUNDLED_PLUGINS
}

/** 各分类计数（按数量降序） */
export function listCategories(plugins = loadPlugins()) {
  const m = new Map()
  for (const p of plugins) m.set(p.category, (m.get(p.category) || 0) + 1)
  return [...m.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
}

/** 从插件列表中按 slug（author/repo 或 repo 短名）查找 */
export function findPlugin(plugins, slug) {
  return plugins.find(
    (p) => p.name === slug || p.repo === slug || `${p.author}/${p.name}` === slug,
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
  // 同时匹配英文描述与中文描述，提升中文用户命中率
  const hay = `${p.description} ${p.descriptionZh || ''} ${p.category} ${p.name} ${p.repo}`.toLowerCase()
  let s = 0
  for (const t of tokens) if (hay.includes(t)) s += 1
  return s
}

// 同分时按 star 数（若有）降序
function byScoreThenStars(a, b) {
  return b.s - a.s || (b.p.stars || 0) - (a.p.stars || 0)
}

function whyFor(p, roleUsed, description, browse) {
  if (browse) return `全量插件池（按星数排序${p.stars != null ? `，⭐${p.stars}` : ''}）`
  if (roleUsed) return `属于「${roleUsed}」预设精选，贴合该角色的典型工作流`
  if (description) return `与你的描述关键词匹配（${p.category}）`
  return `来自全量列表的匹配结果`
}

function summarize(role, roleLabel, query, results, browse, minStars) {
  const head = browse
    ? `插件总池子（共 ${results.length} 个${typeof minStars === 'number' ? `，已按 ⭐≥${minStars} 筛选` : ''}，按星数降序）`
    : role
      ? `为你（角色预设「${roleLabel || role}」）精选 ${results.length} 个插件：`
      : query
        ? `根据你的描述「${query}」推荐 ${results.length} 个插件：`
        : `为你推荐 ${results.length} 个插件：`
  const body = results
    .map(
      (r, i) =>
        `${i + 1}. [${r.name}](${r.url}) — ${r.oneLiner}` +
        (r.stars != null ? ` （⭐${r.stars}）` : '') +
        `\n   安装：${r.installCmd}`,
    )
    .join('\n')
  return `${head}\n\n${body}`
}

/**
 * 推荐核心。role 提供强基线，description 用于关键词精排/补充。
 * @returns {{role:?string, query:?string, results:Array, summary:string}}
 */
export function recommend({ role, description, plugins, roles, maxResults = 8, minStars = null }) {
  let base = []
  let roleUsed = null
  const roleKey = normalizeRole(role, roles)
  if (roleKey && roles && roles[roleKey]) {
    roleUsed = roleKey
    const want = roles[roleKey].plugins || []
    base = want.map((slug) => findPlugin(plugins, slug)).filter(Boolean)
  }
  const tokens = expandTokens(tokenize(description || ''))

  // 最小星数筛选：未知星数（readme 兜底数据）一律保留，避免误伤
  const applyMinStars = (list) =>
    typeof minStars === 'number'
      ? list.filter((p) => p.stars == null || p.stars >= minStars)
      : list

  let scored
  let browse = false
  if (base.length && tokens.length) {
    const others = plugins.filter((p) => !base.includes(p))
    const rankedBase = base
      .map((p) => ({ p, s: scorePlugin(p, tokens) }))
      .sort(byScoreThenStars)
    const extra = others
      .map((p) => ({ p, s: scorePlugin(p, tokens) }))
      .filter((x) => x.s > 0)
      .sort(byScoreThenStars)
      .slice(0, maxResults)
    scored = [...rankedBase, ...extra].slice(0, maxResults)
  } else if (base.length) {
    scored = base.map((p) => ({ p, s: 1 }))
  } else if (tokens.length) {
    scored = applyMinStars(plugins)
      .map((p) => ({ p, s: scorePlugin(p, tokens) }))
      .filter((x) => x.s > 0)
      .sort(byScoreThenStars)
      .slice(0, maxResults)
  } else {
    // 全量浏览：无 role、无 description，按 star 数降序展示整个插件池
    browse = true
    scored = applyMinStars(plugins)
      .map((p) => ({ p, s: p.stars || 0 }))
      .sort((a, b) => (b.p.stars || 0) - (a.p.stars || 0))
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
    oneLiner: p.descriptionZh || p.description,
    stars: p.stars,
    score: s,
    why: whyFor(p, roleUsed, description, browse),
  }))

  const summary = summarize(roleUsed, roleLabel, description, results, browse, minStars)
  return { role: roleUsed, query: description || null, results, summary }
}

// ---- 个人插件栈持久化（~/.dsh/stack-curator/stack.json）----

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
    const desc = meta ? (meta.descriptionZh || meta.description) : ''
    const stars = meta && meta.stars != null ? ` （⭐${meta.stars}）` : ''
    return `${i + 1}. [${p.name}](${p.url}) — ${desc}${stars}\n   安装：${p.installCmd}`
  })
  return `我的插件栈（共 ${stack.plugins.length} 个）：\n\n${lines.join('\n')}`
}

export { CATEGORY_ORDER }
