// test.mjs — 单元测试 stack-curator-core 的纯函数。
import assert from 'node:assert/strict'
import {
  parseReadme,
  tokenize,
  scorePlugin,
  recommend,
  normalizeRole,
  findPlugin,
} from './stack-curator-core.js'

let passed = 0
function ok(name, fn) {
  fn()
  passed++
  console.log('  ✓', name)
}

const FIXTURE = `## Plugins

### UI Enhancements
- [alice/foo](https://github.com/alice/foo) - A UI shortcut plugin for the web client.
- [bob/bar](https://github.com/bob/bar) - Chinese language pack for DSH.

### Memory
- [carol/mem](https://github.com/carol/mem) - Persistent cross-session memory vault.

## Disclaimer
Nothing here.
`

ok('parseReadme 解析分类与条目', () => {
  const ps = parseReadme(FIXTURE)
  assert.equal(ps.length, 3)
  assert.equal(ps[0].category, 'UI Enhancements')
  assert.equal(ps[0].author, 'alice')
  assert.equal(ps[0].repo, 'alice/foo')
  assert.equal(ps[0].name, 'foo')
  assert.ok(ps[0].installCmd.includes('dsh plugin --profile web add'))
  assert.equal(ps[2].category, 'Memory')
  // 不应解析到 Disclaimer 之后
  assert.equal(ps.some((p) => p.name === 'Nothing'), false)
})

ok('parseReadme 去掉行尾分类标签', () => {
  const md = '## Plugins\n\n### Tools\n- [x/y](https://github.com/x/y) - does thing - [Tools]\n'
  const ps = parseReadme(md)
  assert.equal(ps[0].description, 'does thing')
})

ok('tokenize 中英混合分词', () => {
  const t = tokenize('I need 营销 growth 流程图')
  assert.ok(t.includes('营销'))
  assert.ok(t.includes('growth'))
  assert.ok(t.includes('流程图'))
})

ok('scorePlugin 关键词命中', () => {
  const p = { description: 'voice input for web ui', category: 'UI', name: 'a/b', repo: 'b' }
  assert.equal(scorePlugin(p, tokenize('voice')), 1)
  assert.equal(scorePlugin(p, tokenize('zzz')), 0)
})

ok('normalizeRole 支持英文 key 与中文 label', () => {
  const roles = { teacher: { label: '教师' }, developer: { label: '开发者' } }
  assert.equal(normalizeRole('teacher', roles), 'teacher')
  assert.equal(normalizeRole('教师', roles), 'teacher')
  assert.equal(normalizeRole('开发', roles), null)
})

const ROLES = {
  teacher: { label: '教师', plugins: ['alice/foo', 'carol/mem'] },
}
const PLUGINS = parseReadme(FIXTURE)

ok('recommend 按角色给出基线', () => {
  const r = recommend({ role: 'teacher', plugins: PLUGINS, roles: ROLES, maxResults: 8 })
  assert.equal(r.role, 'teacher')
  assert.equal(r.results.length, 2)
  assert.ok(r.summary.includes('教师'))
})

ok('recommend 无 role 按描述关键词精排', () => {
  const r = recommend({ description: 'memory 记忆', plugins: PLUGINS, roles: ROLES, maxResults: 8 })
  assert.equal(r.role, null)
  assert.ok(r.results.length >= 1)
  assert.equal(r.results[0].name, 'mem')
})

ok('recommend 角色+描述：基线优先、描述补充', () => {
  const r = recommend({
    role: 'teacher',
    description: 'memory',
    plugins: PLUGINS,
    roles: ROLES,
    maxResults: 8,
  })
  assert.equal(r.role, 'teacher')
  // 基线 2 个 + 命中 memory 的额外项
  assert.ok(r.results.length >= 2)
})

ok('findPlugin 多形式匹配', () => {
  assert.ok(findPlugin(PLUGINS, 'alice/foo'))
  assert.ok(findPlugin(PLUGINS, 'foo'))
})

const POOL = [
  { name: 'low', stars: 3, category: 'X', url: 'u', installCmd: 'c', descriptionZh: 'd', description: 'd' },
  { name: 'high', stars: 99, category: 'X', url: 'u', installCmd: 'c', descriptionZh: 'd', description: 'd' },
  { name: 'mid', stars: 30, category: 'X', url: 'u', installCmd: 'c', descriptionZh: 'd', description: 'd' },
]

ok('recommend 全量浏览：无 role/description 按星数降序', () => {
  const r = recommend({ plugins: POOL, maxResults: 50 })
  assert.equal(r.results.length, 3)
  assert.equal(r.results[0].name, 'high')
  assert.equal(r.results[1].name, 'mid')
  assert.equal(r.results[2].name, 'low')
  assert.ok(r.summary.includes('插件总池子'))
})

ok('recommend minStars 过滤掉低于阈值的', () => {
  const r = recommend({ plugins: POOL, minStars: 50, maxResults: 50 })
  assert.equal(r.results.length, 1)
  assert.equal(r.results[0].name, 'high')
  assert.ok(r.summary.includes('⭐≥50'))
})

console.log(`\n全部通过：${passed} 个用例 ✓`)
