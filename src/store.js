import crypto from 'node:crypto'
import { DEFAULT_DOMAIN, DEFAULT_PROVIDER_NAME, STORE_VERSION, TOOL_NAMES } from './constants.js'
import { normalizeUrl, readJson, resolveHomePath, slugify, writeJson } from './utils.js'

export const STORE_PATH = resolveHomePath('.hcman', 'providers.json')

export function createDefaultStore() {
  return {
    version: STORE_VERSION,
    providers: [],
    current: {
      codex: null,
      claude: null,
      gemini: null,
      opencode: null
    }
  }
}

export async function loadStore() {
  const store = await readJson(STORE_PATH, createDefaultStore())
  store.version ||= STORE_VERSION
  store.providers ||= []
  store.current ||= {}

  for (const tool of TOOL_NAMES) {
    if (!(tool in store.current)) {
      store.current[tool] = null
    }
  }

  return store
}

export async function saveStore(store) {
  await writeJson(STORE_PATH, store)
}

export function buildProvider(input) {
  const domain = normalizeUrl(input.domain || DEFAULT_DOMAIN)
  const name = (input.name || DEFAULT_PROVIDER_NAME).trim()
  const now = new Date().toISOString()

  return {
    id: input.id || crypto.randomUUID(),
    key: input.key || slugify(name),
    name,
    description: input.description?.trim() || '',
    domain,
    apiKey: input.apiKey.trim(),
    openaiBaseUrl: normalizeUrl(input.openaiBaseUrl || `${domain}/v1`),
    anthropicBaseUrl: normalizeUrl(input.anthropicBaseUrl || domain),
    geminiBaseUrl: normalizeUrl(input.geminiBaseUrl || domain),
    opencodeBaseUrl: normalizeUrl(input.opencodeBaseUrl || `${domain}/v1`),
    createdAt: input.createdAt || now,
    updatedAt: now
  }
}

export function upsertProvider(store, provider) {
  const index = store.providers.findIndex(
    (item) => item.id === provider.id || item.name.toLowerCase() === provider.name.toLowerCase()
  )

  if (index === -1) {
    store.providers.push(provider)
    return provider
  }

  const existing = store.providers[index]
  const nextProvider = {
    ...existing,
    ...provider,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString()
  }

  store.providers[index] = nextProvider
  return nextProvider
}

export function findProvider(store, name) {
  return store.providers.find((provider) => provider.name.toLowerCase() === name.toLowerCase()) || null
}

export function removeProvider(store, name) {
  const provider = findProvider(store, name)
  if (!provider) {
    return null
  }

  store.providers = store.providers.filter((item) => item.id !== provider.id)

  for (const tool of TOOL_NAMES) {
    if (store.current[tool] === provider.id) {
      store.current[tool] = null
    }
  }

  return provider
}

export function setCurrentProvider(store, provider, tool = 'all') {
  if (tool === 'all') {
    for (const toolName of TOOL_NAMES) {
      store.current[toolName] = provider.id
    }
    return
  }

  store.current[tool] = provider.id
}

export function getCurrentProviders(store) {
  const mapping = {}

  for (const tool of TOOL_NAMES) {
    mapping[tool] = store.providers.find((provider) => provider.id === store.current[tool]) || null
  }

  return mapping
}
