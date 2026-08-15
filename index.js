// index.js — dsh plugin entry. Zero build; pure ESM.
import { defineTool } from '@deepseek-ai/dsh-tools'
import { execFileSync } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PLUGINS } from './data/plugins.js'
import { ROLES, ROLE_KEYS } from './data/roles.js'
import {
  recommend,
  readStack,
  addToStack,
  removeFromStack,
  formatStack,
  buildInstallCommands,
  findPlugin,
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
        '可同时给 role 与 description：role 提供强基线，description 用于进一步精排。',
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
          description: '返回的最大插件数（默认 8）。',
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
        if (!args.role && !args.description) {
          const fallback =
            '请告诉我你的角色或需求。可选角色：' +
            ROLE_KEYS.map((k) => `${ROLES[k].emoji} ${ROLES[k].label}`).join('、') +
            '；或描述你常做的工作（如"营销增长""画流程图""写长文"）。'
          return { role: null, query: null, results: [], summary: fallback }
        }
        const out = recommend({
          role: args.role,
          description: args.description,
          plugins: PLUGINS,
          roles: ROLES,
          maxResults: typeof args.maxResults === 'number' ? args.maxResults : 8,
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
        'dsh plugin add）、refresh_snapshot（重新拉取 awesome-dsh-plugin 列表生成快照）。' +
        '形成高度个性化的本地插件库。',
      parameters: {
        action: {
          type: 'string',
          required: true,
          description:
            'list | add | remove | install | refresh_snapshot',
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

        if (action === 'list') {
          const stack = await readStack()
          return {
            action,
            summary: formatStack(stack, PLUGINS),
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
          const { stack, added } = await addToStack(args.plugins, PLUGINS)
          return {
            action,
            summary:
              `已加入 ${added.length} 个：${added.join('、') || '（无新增）'}\n` +
              formatStack(stack, PLUGINS),
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

        if (action === 'refresh_snapshot') {
          try {
            execFileSync(
              'node',
              [HERE + '/scripts/refresh-snap.mjs'],
              { stdio: 'pipe', timeout: 120000 },
            )
            return {
              action,
              summary:
                '已重新拉取 awesome-dsh-plugin 列表并生成 data/plugins.js 快照。',
              commands: [],
              installed: [],
              failed: [],
            }
          } catch (e) {
            return {
              action,
              summary:
                '自动刷新失败（可能网络受限）：' +
                String(e.message || e).slice(0, 160) +
                '\n请在本机手动运行：node ' +
                HERE +
                '/scripts/refresh-snap.mjs',
              commands: ['node ' + HERE + '/scripts/refresh-snap.mjs'],
              installed: [],
              failed: [],
            }
          }
        }

        return {
          action,
          summary:
            '未知 action。可用：list / add / remove / install / refresh_snapshot。',
          commands: [],
          installed: [],
          failed: [],
        }
      },
    }),
  )
}
