// index.js — dsh plugin entry. Zero build; pure ESM.
import { defineTool } from '@deepseek-ai/dsh-tools'
import { execFileSync } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PLUGINS as BUNDLED_PLUGINS } from './data/plugins.js'
import { ROLES, ROLE_KEYS } from './data/roles.js'
import {
  recommend,
  readStack,
  addToStack,
  removeFromStack,
  formatStack,
  buildInstallCommands,
  findPlugin,
  loadPlugins,
  updateCatalog,
  listCategories,
} from './stack-curator-core.js'

const HERE = dirname(fileURLToPath(import.meta.url))

export const name = 'stack-curator'
export const inject = ['tools']

export function apply(ctx) {
  // ---- 工具 1：按角色/描述推荐插件 ----
  ctx.tools.register(
    defineTool({
      name: 'recommend_stack',
      description:
        '为 DeepSeek Harness 用户推荐插件，解决「插件选择困难症」。' +
        '根据用户的职业角色（开发者/教师/设计师/写作者/营销/产品经理/学生/客服）' +
        '或从自然语言描述（如"我需要做营销增长""我要画流程图""我常写长文"）' +
        '匹配 awesome-dsh-plugin 列表中的优质插件，返回带安装命令的精选清单与推荐理由。' +
        '可同时给 role 与 description：role 提供强基线，description 用于进一步精排。' +
        '也可不提供 role/description，直接浏览整个插件池（按 star 数降序），' +
        '并配合 maxResults 限制数量、minStars 限制最低星数——' +
        '例如「列出所有插件」「显示 star 最高的 20 个」「只看 star≥50 的插件」。',
      parameters: {
        role: {
          type: 'string',
          required: false,
          description:
            '职业角色预设，取值之一：' + ROLE_KEYS.join(' / ') + '（也接受中文标签，如"教师"）。',
        },
        description: {
          type: 'string',
          required: false,
          description: '自然语言描述你的工作/需求，用于关键词精排与补充推荐。',
        },
        maxResults: {
          type: 'number',
          required: false,
          description: '返回的最大插件数（默认 8；浏览全量时可调大，如 50）。',
        },
        minStars: {
          type: 'number',
          required: false,
          description: '最小星数筛选：只看 GitHub star 数 ≥ 该值的插件（如 50）。不填则不按星数过滤。',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            role: { type: ['string', 'null'] },
            query: { type: ['string', 'null'] },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  category: { type: 'string' },
                  url: { type: 'string' },
                  installCmd: { type: 'string' },
                  oneLiner: { type: 'string' },
                  stars: { type: ['number', 'null'] },
                  why: { type: 'string' },
                },
              },
            },
            summary: { type: 'string' },
          },
        },
        render: (_args, value) => [{ type: 'text', text: value.summary }],
      },
      async execute(args) {
        // 完全无输入、也无浏览意图（未设 minStars）时，给出引导提示
        if (!args.role && !args.description && typeof args.minStars !== 'number') {
          const fallback =
            '请告诉我你的角色或需求，或让我列出整个插件池。可选角色：' +
            ROLE_KEYS.map((k) => `${ROLES[k].emoji} ${ROLES[k].label}`).join('、') +
            '；或描述你常做的工作（如"营销增长""画流程图""写长文"）；' +
            '也可以直接说「列出所有插件」「显示 star 最高的 20 个」「只看 star≥50 的」。'
          return { role: null, query: null, results: [], summary: fallback }
        }
        const out = recommend({
          role: args.role,
          description: args.description,
          plugins: await loadPlugins(),
          roles: ROLES,
          maxResults: typeof args.maxResults === 'number' ? args.maxResults : 8,
          minStars: typeof args.minStars === 'number' ? args.minStars : null,
        })
        return out
      },
    }),
  )

  // ---- 工具 2：管理个人插件栈 ----
  ctx.tools.register(
    defineTool({
      name: 'manage_stack',
      description:
        '管理用户的个人插件栈（持久化于 ~/.dsh/stack-curator/stack.json）。' +
        '支持：list（查看我的栈）、add（把插件加入栈，需 plugins 数组）、' +
        'remove（从栈移除）、install（一键安装栈上的插件，必须 confirm=true 才真正执行 ' +
        'dsh plugin add）、update_catalog（更新插件目录：优先拉取 awesome-dsh-plugin 官方' +
        '注册表 /plugins.json，失败回退 raw README，结果缓存到 ~/.dsh/stack-curator/catalog.json）。' +
        '形成高度个性化的本地插件库。',
      parameters: {
        action: {
          type: 'string',
          required: true,
          description:
            'list | add | remove | install | update_catalog（refresh_snapshot 为其兼容别名）',
        },
        plugins: {
          type: 'array',
          required: false,
          description: 'add/remove 时的插件 slug 数组，如 ["author/repo"]。',
          items: { type: 'string' },
        },
        confirm: {
          type: 'boolean',
          required: false,
          description: 'install 时为 true 才真正执行安装（默认 false，只返回命令）。',
        },
        profile: {
          type: 'string',
          required: false,
          description: 'install 使用的 profile（默认 web）。',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            action: { type: 'string' },
            summary: { type: 'string' },
            commands: { type: 'array', items: { type: 'string' } },
            installed: { type: 'array', items: { type: 'string' } },
            failed: { type: 'array', items: { type: 'string' } },
          },
        },
        render: (_args, value) => [{ type: 'text', text: value.summary }],
      },
      async execute(args) {
        const action = (args.action || '').toLowerCase()
        const profile = args.profile || 'web'
        const plugins = await loadPlugins()

        if (action === 'list') {
          const stack = await readStack()
          return {
            action,
            summary: formatStack(stack, plugins),
            commands: [],
            installed: [],
            failed: [],
          }
        }

        if (action === 'add') {
          if (!Array.isArray(args.plugins) || !args.plugins.length) {
            return {
              action,
              summary: 'add 需要提供 plugins 数组，例如 ["author/repo"]。',
              commands: [],
              installed: [],
              failed: [],
            }
          }
          const { stack, added } = await addToStack(args.plugins, plugins)
          return {
            action,
            summary:
              `已加入 ${added.length} 个：${added.join('、') || '（无新增）'}\n` +
              formatStack(stack, plugins),
            commands: [],
            installed: added,
            failed: [],
          }
        }

        if (action === 'remove') {
          if (!Array.isArray(args.plugins) || !args.plugins.length) {
            return {
              action,
              summary: 'remove 需要提供 plugins 数组。',
              commands: [],
              installed: [],
              failed: [],
            }
          }
          const { stack, removed } = await removeFromStack(args.plugins)
          return {
            action,
            summary:
              `已移除 ${removed} 个。\n` + formatStack(stack, PLUGINS),
            commands: [],
            installed: [],
            failed: [],
          }
        }

        if (action === 'install') {
          const stack = await readStack()
          const cmds = buildInstallCommands(stack).map((c) =>
            c.replace('--profile web', `--profile ${profile}`),
          )
          if (!cmds.length) {
            return {
              action,
              summary: '我的插件栈为空，先用 add 加入推荐结果再安装。',
              commands: [],
              installed: [],
              failed: [],
            }
          }
          if (!args.confirm) {
            return {
              action,
              summary:
                '以下命令会把「我的栈」全部安装到 profile=' +
                profile +
                '（未执行）。确认无误后把 confirm 设为 true 即可一键安装：\n\n' +
                cmds.join('\n'),
              commands: cmds,
              installed: [],
              failed: [],
            }
          }
          const installed = []
          const failed = []
          for (const cmd of cmds) {
            try {
              execFileSync('dsh', cmd.replace(/^dsh\s+/, '').split(/\s+/), {
                stdio: 'pipe',
                timeout: 120000,
              })
              installed.push(cmd)
            } catch (e) {
              failed.push(`${cmd}  ->  ${String(e.message || e).slice(0, 120)}`)
            }
          }
          return {
            action,
            summary:
              `已安装 ${installed.length} 个，失败 ${failed.length} 个。\n` +
              (failed.length ? '失败项：\n' + failed.join('\n') + '\n' : '') +
              '提示：安装后需重启 http://127.0.0.1:3080/ 服务才能加载新插件。',
            commands: cmds,
            installed,
            failed,
          }
        }

        if (action === 'update_catalog' || action === 'refresh_snapshot') {
          try {
            const res = await updateCatalog({
              onStatus: () => {},
            })
            const cats = listCategories(plugins)
            const topCats = cats
              .slice(0, 6)
              .map((c) => `${c.category}(${c.count})`)
              .join('、')
            return {
              action,
              summary:
                `已更新插件目录：共 ${res.count} 个（来源 ${res.source}），缓存于 ${res.path}。\n` +
                `分类预览：${topCats} …\n` +
                '下次 recommend_stack 会自动用上新目录。',
              commands: ['node ' + HERE + '/scripts/refresh-catalog.mjs'],
              installed: [],
              failed: [],
            }
          } catch (e) {
            return {
              action,
              summary:
                '更新失败（可能网络受限）：' +
                String(e.message || e).slice(0, 160) +
                '\n请在本机手动运行：node ' +
                HERE +
                '/scripts/refresh-catalog.mjs',
              commands: ['node ' + HERE + '/scripts/refresh-catalog.mjs'],
              installed: [],
              failed: [],
            }
          }
        }

        return {
          action,
          summary:
            '未知 action。可用：list / add / remove / install / update_catalog。',
          commands: [],
          installed: [],
          failed: [],
        }
      },
    }),
  )
}
