// examples/run.mjs — 演示 stack-curator 的推荐能力（用真实快照数据）。
// 用法：
//   node examples/run.mjs                       # 跑内置示例场景
//   node examples/run.mjs "我常写长文，需要引用资料"  # 用自定义描述试一次
import { PLUGINS } from '../data/plugins.js'
import { ROLES } from '../data/roles.js'
import { recommend } from '../stack-curator-core.js'

const arg = process.argv[2]
const scenes = arg
  ? [{ title: `自定义描述：${arg}`, role: undefined, description: arg }]
  : [
      { title: '场景1：按角色（教师）', role: 'teacher', description: undefined },
      { title: '场景2：按描述（营销增长）', role: undefined, description: '我需要做营销增长，要发到社媒、做多语言' },
      { title: '场景3：角色+描述（开发者 + 画流程图）', role: 'developer', description: '经常要画流程图和架构图' },
      { title: '场景4：纯描述（长文写作）', role: undefined, description: '我常写长文，需要引用资料和记忆' },
    ]

console.log(`数据源：data/plugins.js（${PLUGINS.length} 个插件，awesome-dsh-plugin 快照）\n`)
for (const s of scenes) {
  const out = recommend({
    role: s.role,
    description: s.description,
    plugins: PLUGINS,
    roles: ROLES,
    maxResults: 6,
  })
  console.log('='.repeat(60))
  console.log(s.title)
  console.log('-'.repeat(60))
  console.log(out.summary)
  console.log('')
}
