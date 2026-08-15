// refresh-catalog.mjs — 更新插件目录（命令行版）。
// 对应 manage_stack 的 update_catalog 动作。优先消费 awesome-dsh-plugin 官方
// 公开注册表 /plugins.json，失败回退 raw README，结果缓存到
// ~/.dsh/stack-curator/catalog.json。
//
// 用法：
//   node scripts/refresh-catalog.mjs            # 联网更新
//   DEBUG=1 node scripts/refresh-catalog.mjs    # 打印状态
import { updateCatalog, listCategories, CATALOG_CACHE } from '../stack-curator-core.js'

const DEBUG = process.env.DEBUG === '1'
const logs = []
const onStatus = (m) => {
  if (DEBUG) console.error('· ' + m)
  logs.push(m)
}

try {
  const res = await updateCatalog({ onStatus })
  const cats = listCategories()
  console.log(`✓ 更新完成：共 ${res.count} 个插件（来源 ${res.source}）`)
  console.log(`  缓存：${res.path}`)
  console.log(`  更新时间：${res.updated}`)
  console.log('  分类（按数量）：')
  for (const c of cats) console.log(`    - ${c.category}: ${c.count}`)
  process.exit(0)
} catch (e) {
  console.error('✗ 更新失败：', e.message)
  console.error('  可检查网络，或稍后重试。')
  process.exit(1)
}
