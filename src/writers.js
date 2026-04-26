import { TOOL_LABELS } from './constants.js'
import { parseEnv, readJson, readText, readToml, resolveHomePath, serializeEnv, writeJson, writeText, writeToml } from './utils.js'

export const CONFIG_PATHS = {
  codexConfig: resolveHomePath('.codex', 'config.toml'),
  codexAuth: resolveHomePath('.codex', 'auth.json'),
  claude: resolveHomePath('.claude', 'settings.json'),
  geminiSettings: resolveHomePath('.gemini', 'settings.json'),
  geminiEnv: resolveHomePath('.gemini', '.env'),
  opencode: resolveHomePath('.config', 'opencode', 'opencode.json')
}

export async function writeCodex(provider) {
  const config = await readToml(CONFIG_PATHS.codexConfig, {})
  config.model ||= 'gpt-5.4'
  config.model_provider = provider.key
  config.model_providers ||= {}
  config.model_providers[provider.key] = {
    name: provider.name,
    base_url: provider.openaiBaseUrl,
    wire_api: 'responses',
    requires_openai_auth: true
  }

  await writeToml(CONFIG_PATHS.codexConfig, config)

  const auth = await readJson(CONFIG_PATHS.codexAuth, {})
  auth.OPENAI_API_KEY = provider.apiKey
  await writeJson(CONFIG_PATHS.codexAuth, auth)

  return [CONFIG_PATHS.codexConfig, CONFIG_PATHS.codexAuth]
}

export async function writeClaude(provider) {
  const config = await readJson(CONFIG_PATHS.claude, {})
  config.env ||= {}
  config.env.ANTHROPIC_AUTH_TOKEN = provider.apiKey
  config.env.ANTHROPIC_BASE_URL = provider.anthropicBaseUrl
  config.permissions ||= { allow: [], deny: [] }

  await writeJson(CONFIG_PATHS.claude, config)
  return [CONFIG_PATHS.claude]
}

export async function writeGemini(provider) {
  const settings = await readJson(CONFIG_PATHS.geminiSettings, {})
  settings.ide ||= { enabled: true }
  settings.security ||= {}
  settings.security.auth ||= {}
  settings.security.auth.selectedType = 'gemini-api-key'

  await writeJson(CONFIG_PATHS.geminiSettings, settings)

  const envContent = await readText(CONFIG_PATHS.geminiEnv, '')
  const env = parseEnv(envContent)
  env.GOOGLE_GEMINI_BASE_URL = provider.geminiBaseUrl
  env.GEMINI_API_KEY = provider.apiKey

  await writeText(CONFIG_PATHS.geminiEnv, serializeEnv(env))
  return [CONFIG_PATHS.geminiSettings, CONFIG_PATHS.geminiEnv]
}

export async function writeOpenCode(provider) {
  const config = await readJson(CONFIG_PATHS.opencode, {})
  config.$schema ||= 'https://opencode.ai/config.json'
  config.model ||= 'openai/gpt-5.4'
  config.provider ||= {}
  config.provider.openai ||= {}
  config.provider.openai.options ||= {}
  config.provider.openai.options.baseURL = provider.opencodeBaseUrl
  config.provider.openai.options.apiKey = provider.apiKey

  await writeJson(CONFIG_PATHS.opencode, config)
  return [CONFIG_PATHS.opencode]
}

export async function applyProvider(provider, tool = 'all') {
  if (tool === 'all') {
    const changedFiles = []
    changedFiles.push(...(await writeCodex(provider)))
    changedFiles.push(...(await writeClaude(provider)))
    changedFiles.push(...(await writeGemini(provider)))
    changedFiles.push(...(await writeOpenCode(provider)))
    return changedFiles
  }

  switch (tool) {
    case 'codex':
      return writeCodex(provider)
    case 'claude':
      return writeClaude(provider)
    case 'gemini':
      return writeGemini(provider)
    case 'opencode':
      return writeOpenCode(provider)
    default:
      throw new Error(`未知工具: ${tool}`)
  }
}

export function describeTarget(tool) {
  if (tool === 'all') {
    return '所有工具'
  }

  return TOOL_LABELS[tool]
}
