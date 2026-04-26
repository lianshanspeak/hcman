import { Command } from 'commander'
import inquirer from 'inquirer'
import { DEFAULT_DOMAIN, DEFAULT_PROVIDER_NAME, TOOL_ALIASES, TOOL_LABELS, TOOL_NAMES } from './constants.js'
import { buildProvider, findProvider, getCurrentProviders, loadStore, removeProvider, saveStore, setCurrentProvider, upsertProvider } from './store.js'
import { normalizeUrl, toolToSelection } from './utils.js'
import { CONFIG_PATHS, applyProvider, describeTarget } from './writers.js'

function resolveTool(tool) {
  if (!tool) {
    return 'all'
  }

  if (tool === 'all') {
    return 'all'
  }

  if (TOOL_NAMES.includes(tool)) {
    return tool
  }

  if (tool in TOOL_ALIASES) {
    return TOOL_ALIASES[tool]
  }

  throw new Error(`未知工具: ${tool}`)
}

function getToolBaseUrls(domain) {
  const normalizedDomain = normalizeUrl(domain)
  return {
    openaiBaseUrl: `${normalizedDomain}/v1`,
    anthropicBaseUrl: normalizedDomain,
    geminiBaseUrl: normalizedDomain,
    opencodeBaseUrl: `${normalizedDomain}/v1`
  }
}

function getToolBaseUrl(provider, tool) {
  switch (tool) {
    case 'codex':
      return provider.openaiBaseUrl
    case 'claude':
      return provider.anthropicBaseUrl
    case 'gemini':
      return provider.geminiBaseUrl
    case 'opencode':
      return provider.opencodeBaseUrl
    default:
      return provider.domain
  }
}

function hasCustomBaseUrls(provider) {
  const defaults = getToolBaseUrls(provider.domain || DEFAULT_DOMAIN)
  return (
    provider.openaiBaseUrl !== defaults.openaiBaseUrl ||
    provider.anthropicBaseUrl !== defaults.anthropicBaseUrl ||
    provider.geminiBaseUrl !== defaults.geminiBaseUrl ||
    provider.opencodeBaseUrl !== defaults.opencodeBaseUrl
  )
}

function printProvider(provider) {
  console.log(`${provider.name}`)
  console.log(`  domain: ${provider.domain}`)
  console.log(`  codex: ${provider.openaiBaseUrl}`)
  console.log(`  claude: ${provider.anthropicBaseUrl}`)
  console.log(`  gemini: ${provider.geminiBaseUrl}`)
  console.log(`  opencode: ${provider.opencodeBaseUrl}`)
}

function printChangedFiles(paths) {
  console.log('已写入文件:')
  for (const filePath of paths) {
    console.log(`  ${filePath}`)
  }
}

function formatToolNames(tools) {
  return tools.map((tool) => TOOL_LABELS[tool]).join(', ')
}

function printToolProviderList(store, tool = 'all') {
  const currentProviders = getCurrentProviders(store)

  if (store.providers.length === 0) {
    console.log('还没有保存任何 provider')
    return
  }

  for (const provider of store.providers) {
    if (tool === 'all') {
      const currentTools = TOOL_NAMES.filter((toolName) => currentProviders[toolName]?.id === provider.id)
      console.log(`- ${provider.name}${currentTools.length > 0 ? ` [${currentTools.join(', ')}]` : ''}`)
      console.log(`  ${provider.domain}`)
      continue
    }

    const isCurrent = currentProviders[tool]?.id === provider.id
    console.log(`- ${provider.name}${isCurrent ? ' [当前]' : ''}`)
    console.log(`  ${getToolBaseUrl(provider, tool)}`)
  }
}

function getProviderChoices(store, tool = 'all') {
  const currentProviders = getCurrentProviders(store)
  return store.providers.map((provider) => ({
    name:
      tool === 'all'
        ? provider.name
        : `${provider.name}${currentProviders[tool]?.id === provider.id ? ' [当前]' : ''}`,
    value: provider.name
  }))
}

async function promptProviderInput(defaults = {}) {
  const questions = []

  if (!defaults.name) {
    questions.push({
      type: 'input',
      name: 'name',
      message: 'Provider 名称',
      default: DEFAULT_PROVIDER_NAME
    })
  }

  if (!defaults.apiKey) {
    questions.push({
      type: 'password',
      name: 'apiKey',
      message: 'API Key'
    })
  }

  if (!defaults.domain && !defaults.openaiBaseUrl && !defaults.anthropicBaseUrl && !defaults.geminiBaseUrl && !defaults.opencodeBaseUrl) {
    questions.push({
      type: 'input',
      name: 'domain',
      message: '默认域名',
      default: DEFAULT_DOMAIN
    })
  }

  const answers = questions.length > 0 ? await inquirer.prompt(questions) : {}
  return {
    ...defaults,
    ...answers
  }
}

async function promptProviderForm(defaults = {}, options = {}) {
  const mode = options.mode || 'create'
  const currentDomain = defaults.domain || DEFAULT_DOMAIN
  const currentUrls = {
    ...getToolBaseUrls(currentDomain),
    openaiBaseUrl: defaults.openaiBaseUrl || getToolBaseUrls(currentDomain).openaiBaseUrl,
    anthropicBaseUrl: defaults.anthropicBaseUrl || getToolBaseUrls(currentDomain).anthropicBaseUrl,
    geminiBaseUrl: defaults.geminiBaseUrl || getToolBaseUrls(currentDomain).geminiBaseUrl,
    opencodeBaseUrl: defaults.opencodeBaseUrl || getToolBaseUrls(currentDomain).opencodeBaseUrl
  }

  const baseAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Provider 名称',
      default: defaults.name || DEFAULT_PROVIDER_NAME,
      validate: (value) => (value?.trim() ? true : '名称不能为空')
    },
    {
      type: 'input',
      name: 'description',
      message: '描述(可选)',
      default: defaults.description || ''
    },
    {
      type: 'password',
      name: 'apiKey',
      message: mode === 'edit' || mode === 'clone' ? 'API Key（留空则保持原值）' : 'API Key',
      mask: '*',
      validate: (value) => {
        if ((mode === 'edit' || mode === 'clone') && !value.trim()) {
          return true
        }
        return value?.trim() ? true : 'API Key 不能为空'
      }
    },
    {
      type: 'input',
      name: 'domain',
      message: '默认域名',
      default: currentDomain,
      validate: (value) => {
        try {
          normalizeUrl(value)
          return true
        } catch (error) {
          return error.message
        }
      }
    },
    {
      type: 'list',
      name: 'urlMode',
      message: '地址模式',
      default: hasCustomBaseUrls({ domain: currentDomain, ...currentUrls }) ? 'custom' : 'derived',
      choices: [
        { name: '统一域名自动生成各工具地址', value: 'derived' },
        { name: '分别自定义各工具 Base URL', value: 'custom' }
      ]
    }
  ])

  let urlAnswers = {}

  if (baseAnswers.urlMode === 'custom') {
    urlAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'openaiBaseUrl',
        message: 'Codex Base URL',
        default: currentUrls.openaiBaseUrl,
        validate: (value) => {
          try {
            normalizeUrl(value)
            return true
          } catch (error) {
            return error.message
          }
        }
      },
      {
        type: 'input',
        name: 'anthropicBaseUrl',
        message: 'Claude Code Base URL',
        default: currentUrls.anthropicBaseUrl,
        validate: (value) => {
          try {
            normalizeUrl(value)
            return true
          } catch (error) {
            return error.message
          }
        }
      },
      {
        type: 'input',
        name: 'geminiBaseUrl',
        message: 'Gemini CLI Base URL',
        default: currentUrls.geminiBaseUrl,
        validate: (value) => {
          try {
            normalizeUrl(value)
            return true
          } catch (error) {
            return error.message
          }
        }
      },
      {
        type: 'input',
        name: 'opencodeBaseUrl',
        message: 'OpenCode Base URL',
        default: currentUrls.opencodeBaseUrl,
        validate: (value) => {
          try {
            normalizeUrl(value)
            return true
          } catch (error) {
            return error.message
          }
        }
      }
    ])
  }

  const normalizedDomain = normalizeUrl(baseAnswers.domain)
  const derivedUrls = getToolBaseUrls(normalizedDomain)
  const normalizedApiKey = baseAnswers.apiKey.trim() || defaults.apiKey || ''

  return {
    name: baseAnswers.name.trim(),
    description: baseAnswers.description.trim(),
    apiKey: normalizedApiKey,
    domain: normalizedDomain,
    openaiBaseUrl: baseAnswers.urlMode === 'custom' ? normalizeUrl(urlAnswers.openaiBaseUrl) : derivedUrls.openaiBaseUrl,
    anthropicBaseUrl: baseAnswers.urlMode === 'custom' ? normalizeUrl(urlAnswers.anthropicBaseUrl) : derivedUrls.anthropicBaseUrl,
    geminiBaseUrl: baseAnswers.urlMode === 'custom' ? normalizeUrl(urlAnswers.geminiBaseUrl) : derivedUrls.geminiBaseUrl,
    opencodeBaseUrl: baseAnswers.urlMode === 'custom' ? normalizeUrl(urlAnswers.opencodeBaseUrl) : derivedUrls.opencodeBaseUrl
  }
}

async function promptConfirm(message, defaultValue = true) {
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: defaultValue
    }
  ])

  return answers.confirmed
}

async function pause() {
  await inquirer.prompt([
    {
      type: 'input',
      name: 'continue',
      message: '按回车继续'
    }
  ])
}

async function saveProviderFromOptions(options) {
  const input = await promptProviderInput(options)

  if (!input.apiKey?.trim()) {
    throw new Error('API Key 不能为空')
  }

  return saveProvider(input)
}

async function saveProvider(input) {
  const provider = buildProvider(input)
  const store = await loadStore()
  const saved = upsertProvider(store, provider)
  await saveStore(store)
  return { store, provider: saved }
}

async function addProviderInteractive(defaults = {}) {
  const input = await promptProviderForm(defaults)
  const provider = buildProvider(input)
  const store = await loadStore()
  const saved = upsertProvider(store, provider)
  await saveStore(store)
  return saved
}

function ensureProviderNameConflict(store, name, currentProviderId = null) {
  const matched = store.providers.find((provider) => provider.name.toLowerCase() === name.toLowerCase())

  if (!matched) {
    return
  }

  if (currentProviderId && matched.id === currentProviderId) {
    return
  }

  throw new Error(`provider 名称已存在: ${name}`)
}

async function reapplyEditedProviderToCurrentTools(store, provider) {
  const currentProviders = getCurrentProviders(store)
  const changedFiles = []

  for (const tool of TOOL_NAMES) {
    if (currentProviders[tool]?.id === provider.id) {
      changedFiles.push(...(await applyProvider(provider, tool)))
    }
  }

  return changedFiles
}

async function editProviderInteractive(name) {
  const store = await loadStore()
  const existing = findProvider(store, name)

  if (!existing) {
    throw new Error(`未找到 provider: ${name}`)
  }

  const updates = await promptProviderForm(existing, { mode: 'edit' })
  ensureProviderNameConflict(store, updates.name, existing.id)
  const updatedProvider = buildProvider({
    ...existing,
    ...updates,
    id: existing.id,
    key: existing.key,
    createdAt: existing.createdAt
  })

  const saved = upsertProvider(store, updatedProvider)
  const changedFiles = await reapplyEditedProviderToCurrentTools(store, saved)
  await saveStore(store)
  return { provider: saved, changedFiles }
}

async function cloneProviderInteractive(name, providedTargetName) {
  const store = await loadStore()
  const source = findProvider(store, name)

  if (!source) {
    throw new Error(`未找到 provider: ${name}`)
  }

  const cloneDefaults = {
    ...source,
    name: providedTargetName || `${source.name}-copy`
  }
  const input = await promptProviderForm(cloneDefaults, { mode: 'clone' })
  ensureProviderNameConflict(store, input.name)
  const clonedProvider = buildProvider(input)
  const saved = upsertProvider(store, clonedProvider)
  await saveStore(store)
  return saved
}

async function useProvider(name, requestedTool = 'all') {
  const tool = resolveTool(requestedTool)
  const store = await loadStore()
  const provider = findProvider(store, name)

  if (!provider) {
    throw new Error(`未找到 provider: ${name}`)
  }

  const changedFiles = await applyProvider(provider, tool)
  setCurrentProvider(store, provider, toolToSelection(tool))
  await saveStore(store)

  console.log(`已将 ${provider.name} 应用到 ${describeTarget(tool)}`)
  printChangedFiles(changedFiles)
}

async function showCurrent(tool = 'all') {
  const resolvedTool = resolveTool(tool)
  const store = await loadStore()
  const currentProviders = getCurrentProviders(store)

  if (resolvedTool === 'all') {
    for (const toolName of TOOL_NAMES) {
      const current = currentProviders[toolName]
      const label = TOOL_LABELS[toolName]
      console.log(`${label}: ${current ? current.name : '未设置'}`)
    }
    return
  }

  const current = currentProviders[resolvedTool]

  if (!current) {
    console.log(`${TOOL_LABELS[resolvedTool]}: 未设置`)
    return
  }

  console.log(`${TOOL_LABELS[resolvedTool]}: ${current.name}`)
  console.log(`  ${getToolBaseUrl(current, resolvedTool)}`)
}

async function removeProviderByName(name) {
  const store = await loadStore()
  const removed = removeProvider(store, name)

  if (!removed) {
    throw new Error(`未找到 provider: ${name}`)
  }

  await saveStore(store)
  return removed
}

async function listProviders(tool = 'all') {
  const resolvedTool = resolveTool(tool)
  const store = await loadStore()
  printToolProviderList(store, resolvedTool)
}

function parseSelectedTools(platforms) {
  if (!platforms || platforms === 'all') {
    return [...TOOL_NAMES]
  }

  const selectedTools = [
    ...new Set(
      platforms
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => resolveTool(item))
    )
  ]

  if (selectedTools.length === 0) {
    throw new Error('至少选择一个服务')
  }

  return selectedTools
}

async function promptSelectedTools(defaultSelectedTools = []) {
  const answers = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedTools',
      message: '选择要配置的服务',
      choices: TOOL_NAMES.map((tool) => ({
        name: TOOL_LABELS[tool],
        value: tool,
        checked: defaultSelectedTools.includes(tool)
      })),
      validate: (value) => (value.length > 0 ? true : '至少选择一个服务')
    }
  ])

  return answers.selectedTools
}

async function promptApiKey(message = 'API Key') {
  const answers = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message,
      mask: '*',
      validate: (value) => (value?.trim() ? true : 'API Key 不能为空')
    }
  ])

  return answers.apiKey.trim()
}

async function applyProviderToTools(provider, selectedTools) {
  const store = await loadStore()
  const changedFiles = []

  for (const tool of selectedTools) {
    changedFiles.push(...(await applyProvider(provider, tool)))
    setCurrentProvider(store, provider, tool)
  }

  await saveStore(store)
  return changedFiles
}

async function runHiCodeShortcut(options = {}) {
  const selectedTools = options.platforms ? parseSelectedTools(options.platforms) : await promptSelectedTools()
  const apiKey = options.apiKey?.trim() || (await promptApiKey('请输入 HiCode API Key'))
  const { provider } = await saveProvider({
    name: 'hicode',
    description: 'HiCode preset',
    domain: DEFAULT_DOMAIN,
    apiKey
  })
  const changedFiles = await applyProviderToTools(provider, selectedTools)

  console.log(`已将 hicode 应用到: ${formatToolNames(selectedTools)}`)
  printProvider(provider)
  printChangedFiles(changedFiles)
}

async function quickInitInteractive() {
  const provider = await addProviderInteractive({
    name: DEFAULT_PROVIDER_NAME,
    domain: DEFAULT_DOMAIN
  })
  const store = await loadStore()
  const changedFiles = await applyProvider(provider, 'all')
  setCurrentProvider(store, provider, 'all')
  await saveStore(store)

  console.log(`已初始化 provider: ${provider.name}`)
  printProvider(provider)
  printChangedFiles(changedFiles)
}

async function chooseProviderName(message, tool = 'all') {
  const store = await loadStore()

  if (store.providers.length === 0) {
    throw new Error('还没有保存任何 provider')
  }

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'providerName',
      message,
      choices: getProviderChoices(store, tool)
    }
  ])

  return answers.providerName
}

async function handleInteractiveAdd(tool) {
  const provider = await addProviderInteractive({
    name: DEFAULT_PROVIDER_NAME
  })
  console.log(`已保存 provider: ${provider.name}`)
  printProvider(provider)

  const shouldUse = await promptConfirm(`是否立即切换到 ${TOOL_LABELS[tool]}?`, true)
  if (shouldUse) {
    await useProvider(provider.name, tool)
  }
}

async function handleInteractiveSwitch(tool) {
  const providerName = await chooseProviderName(`选择要切换到 ${TOOL_LABELS[tool]} 的 provider`, tool)
  await useProvider(providerName, tool)
}

async function handleInteractiveCurrent(tool) {
  await showCurrent(tool)
}

async function handleInteractiveList(tool) {
  await listProviders(tool)
}

async function handleInteractiveEdit(tool) {
  const providerName = await chooseProviderName(`选择要编辑的 ${TOOL_LABELS[tool]} provider`, tool)
  const { provider, changedFiles } = await editProviderInteractive(providerName)
  console.log(`已更新 provider: ${provider.name}`)
  printProvider(provider)
  if (changedFiles.length > 0) {
    printChangedFiles(changedFiles)
  }
}

async function handleInteractiveClone(tool) {
  const providerName = await chooseProviderName(`选择要克隆的 ${TOOL_LABELS[tool]} provider`, tool)
  const provider = await cloneProviderInteractive(providerName)
  console.log(`已克隆 provider: ${provider.name}`)
  printProvider(provider)

  const shouldUse = await promptConfirm(`是否立即切换到 ${TOOL_LABELS[tool]} 的新 provider?`, false)
  if (shouldUse) {
    await useProvider(provider.name, tool)
  }
}

async function handleInteractiveRemove(tool) {
  const providerName = await chooseProviderName(`选择要删除的 ${TOOL_LABELS[tool]} provider`, tool)
  const shouldRemove = await promptConfirm(`确认删除 provider ${providerName} ?`, false)

  if (!shouldRemove) {
    console.log('已取消删除')
    return
  }

  const removed = await removeProviderByName(providerName)
  console.log(`已删除 provider: ${removed.name}`)
}

async function startToolMenu(tool) {
  while (true) {
    console.log('')
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: `${TOOL_LABELS[tool]} 操作`,
        choices: [
          { name: '添加服务商', value: 'add' },
          { name: '切换服务商', value: 'switch' },
          { name: '列出所有服务商', value: 'list' },
          { name: '查看当前服务商', value: 'current' },
          { name: '编辑服务商', value: 'edit' },
          { name: '克隆服务商', value: 'clone' },
          { name: '删除服务商', value: 'remove' },
          { name: '返回上级', value: 'back' }
        ]
      }
    ])

    if (answers.action === 'back') {
      return
    }

    try {
      switch (answers.action) {
        case 'add':
          await handleInteractiveAdd(tool)
          break
        case 'switch':
          await handleInteractiveSwitch(tool)
          break
        case 'list':
          await handleInteractiveList(tool)
          break
        case 'current':
          await handleInteractiveCurrent(tool)
          break
        case 'edit':
          await handleInteractiveEdit(tool)
          break
        case 'clone':
          await handleInteractiveClone(tool)
          break
        case 'remove':
          await handleInteractiveRemove(tool)
          break
      }
    } catch (error) {
      console.error(error.message)
    }

    await pause()
  }
}

async function startMainMenu() {
  while (true) {
    console.log('')
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '请选择操作',
        choices: [
          { name: 'Codex 管理', value: 'codex' },
          { name: 'Claude Code 管理', value: 'claude' },
          { name: 'Gemini CLI 管理', value: 'gemini' },
          { name: 'OpenCode 管理', value: 'opencode' },
          { name: 'HiCode 快捷配置', value: 'hicode' },
          { name: '一键初始化 HiCode', value: 'init' },
          { name: '查看当前状态', value: 'status' },
          { name: '退出', value: 'exit' }
        ]
      }
    ])

    if (answers.action === 'exit') {
      return
    }

    try {
      switch (answers.action) {
        case 'codex':
        case 'claude':
        case 'gemini':
        case 'opencode':
          await startToolMenu(answers.action)
          break
        case 'hicode':
          await runHiCodeShortcut()
          await pause()
          break
        case 'init':
          await quickInitInteractive()
          await pause()
          break
        case 'status':
          await showCurrent('all')
          console.log('')
          console.log('配置路径:')
          for (const [name, filePath] of Object.entries(CONFIG_PATHS)) {
            console.log(`  ${name}: ${filePath}`)
          }
          await pause()
          break
      }
    } catch (error) {
      console.error(error.message)
      await pause()
    }
  }
}

function registerToolCommands(command, tool) {
  command
    .command('add')
    .argument('[name]', 'provider 名称')
    .description(`保存一个 ${TOOL_LABELS[tool]} provider`)
    .option('--api-key <apiKey>', 'API Key')
    .option('--domain <domain>', '默认域名', DEFAULT_DOMAIN)
    .option('--description <description>', '描述')
    .option('--openai-base-url <url>', 'Codex/OpenAI 风格 Base URL')
    .option('--anthropic-base-url <url>', 'Claude Code Base URL')
    .option('--gemini-base-url <url>', 'Gemini Base URL')
    .option('--opencode-base-url <url>', 'OpenCode Base URL')
    .action(async function (name) {
      const options = this.opts()
      const { provider } = await saveProviderFromOptions({ ...options, name })
      console.log(`已保存 provider: ${provider.name}`)
      printProvider(provider)
    })

  command
    .command('list')
    .description(`列出 ${TOOL_LABELS[tool]} provider`)
    .action(async () => {
      await listProviders(tool)
    })

  command
    .command('use')
    .argument('<name>', 'provider 名称')
    .description(`把 provider 应用到 ${TOOL_LABELS[tool]}`)
    .action(async (name) => {
      await useProvider(name, tool)
    })

  command
    .command('current')
    .description(`查看 ${TOOL_LABELS[tool]} 当前 provider`)
    .action(async () => {
      await showCurrent(tool)
    })

  command
    .command('edit')
    .argument('<name>', 'provider 名称')
    .description(`编辑 ${TOOL_LABELS[tool]} provider`)
    .action(async (name) => {
      const { provider, changedFiles } = await editProviderInteractive(name)
      console.log(`已更新 provider: ${provider.name}`)
      printProvider(provider)
      if (changedFiles.length > 0) {
        printChangedFiles(changedFiles)
      }
    })

  command
    .command('clone')
    .argument('<name>', '源 provider 名称')
    .argument('[targetName]', '新 provider 名称')
    .description(`克隆 ${TOOL_LABELS[tool]} provider`)
    .action(async (name, targetName) => {
      const provider = await cloneProviderInteractive(name, targetName)
      console.log(`已克隆 provider: ${provider.name}`)
      printProvider(provider)
    })

  command
    .command('remove')
    .argument('<name>', 'provider 名称')
    .description(`删除 ${TOOL_LABELS[tool]} provider`)
    .action(async (name) => {
      const removed = await removeProviderByName(name)
      console.log(`已删除 provider: ${removed.name}`)
    })
}

export async function run(argv = process.argv) {
  const program = new Command()

  program
    .name('hcman')
    .description('HiCode provider manager for Codex, Claude Code, Gemini CLI, and OpenCode')
    .version('0.1.0')

  program
    .command('hicode [apiKey]')
    .description('固定使用 https://www.hicode.codes，选择服务后写入配置')
    .option('-p, --platform <platforms>', '指定服务，支持 codex,claude,gemini,opencode,all')
    .action(async function (apiKey) {
      const options = this.opts()
      await runHiCodeShortcut({
        apiKey,
        platforms: options.platform
      })
    })

  program
    .command('init')
    .description('初始化默认 provider 并直接写入全部工具')
    .option('--name <name>', 'provider 名称', DEFAULT_PROVIDER_NAME)
    .option('--api-key <apiKey>', 'API Key')
    .option('--domain <domain>', '默认域名', DEFAULT_DOMAIN)
    .option('--openai-base-url <url>', 'Codex/OpenAI 风格 Base URL')
    .option('--anthropic-base-url <url>', 'Claude Code Base URL')
    .option('--gemini-base-url <url>', 'Gemini Base URL')
    .option('--opencode-base-url <url>', 'OpenCode Base URL')
    .action(async function () {
      const options = this.opts()
      const { provider, store } = await saveProviderFromOptions(options)
      const changedFiles = await applyProvider(provider, 'all')
      setCurrentProvider(store, provider, 'all')
      await saveStore(store)

      console.log(`已初始化 provider: ${provider.name}`)
      printProvider(provider)
      printChangedFiles(changedFiles)
    })

  const providerCommand = program.command('provider').alias('p').description('provider 管理')

  providerCommand
    .command('add')
    .argument('[name]', 'provider 名称')
    .description('保存一个 provider')
    .option('--api-key <apiKey>', 'API Key')
    .option('--domain <domain>', '默认域名', DEFAULT_DOMAIN)
    .option('--description <description>', '描述')
    .option('--openai-base-url <url>', 'Codex/OpenAI 风格 Base URL')
    .option('--anthropic-base-url <url>', 'Claude Code Base URL')
    .option('--gemini-base-url <url>', 'Gemini Base URL')
    .option('--opencode-base-url <url>', 'OpenCode Base URL')
    .action(async function (name) {
      const options = this.opts()
      const { provider } = await saveProviderFromOptions({ ...options, name })
      console.log(`已保存 provider: ${provider.name}`)
      printProvider(provider)
    })

  providerCommand
    .command('list')
    .description('列出全部 provider')
    .action(async () => {
      await listProviders('all')
    })

  providerCommand
    .command('use')
    .argument('<name>', 'provider 名称')
    .description('应用 provider 到指定工具')
    .option('--tool <tool>', 'all/codex/claude/gemini/opencode', 'all')
    .action(async function (name) {
      const options = this.opts()
      await useProvider(name, options.tool)
    })

  providerCommand
    .command('current')
    .description('查看当前 provider')
    .option('--tool <tool>', 'all/codex/claude/gemini/opencode', 'all')
    .action(async function () {
      const options = this.opts()
      await showCurrent(options.tool)
    })

  providerCommand
    .command('edit')
    .argument('<name>', 'provider 名称')
    .description('编辑一个 provider')
    .action(async (name) => {
      const { provider, changedFiles } = await editProviderInteractive(name)
      console.log(`已更新 provider: ${provider.name}`)
      printProvider(provider)
      if (changedFiles.length > 0) {
        printChangedFiles(changedFiles)
      }
    })

  providerCommand
    .command('clone')
    .argument('<name>', '源 provider 名称')
    .argument('[targetName]', '新 provider 名称')
    .description('克隆一个 provider')
    .action(async (name, targetName) => {
      const provider = await cloneProviderInteractive(name, targetName)
      console.log(`已克隆 provider: ${provider.name}`)
      printProvider(provider)
    })

  providerCommand
    .command('remove')
    .argument('<name>', 'provider 名称')
    .description('删除一个 provider')
    .action(async (name) => {
      const removed = await removeProviderByName(name)
      console.log(`已删除 provider: ${removed.name}`)
    })

  program
    .command('status')
    .description('查看当前状态和配置路径')
    .action(async () => {
      await showCurrent('all')
      console.log('')
      console.log('配置路径:')
      for (const [name, filePath] of Object.entries(CONFIG_PATHS)) {
        console.log(`  ${name}: ${filePath}`)
      }
    })

  for (const [alias, tool] of Object.entries(TOOL_ALIASES)) {
    const command = program.command(alias).description(`管理 ${TOOL_LABELS[tool]}`)
    registerToolCommands(command, tool)
    command.action(async () => {
      await startToolMenu(tool)
    })
  }

  if (argv.slice(2).length === 0) {
    await startMainMenu()
    return
  }

  await program.parseAsync(argv)
}
