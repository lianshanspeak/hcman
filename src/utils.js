import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import TOML from '@iarna/toml'

export function resolveHomePath(...segments) {
  return path.join(os.homedir(), ...segments)
}

export async function ensureDirForFile(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
}

export async function backupIfExists(filePath) {
  try {
    await fs.access(filePath)
  } catch {
    return
  }

  const backupPath = `${filePath}.hcman.bak`
  await fs.copyFile(filePath, backupPath)
}

export async function readJson(filePath, fallback = {}) {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    return JSON.parse(content)
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return structuredClone(fallback)
    }

    throw new Error(`无法读取 JSON 文件 ${filePath}: ${error.message}`)
  }
}

export async function writeJson(filePath, value) {
  await ensureDirForFile(filePath)
  await backupIfExists(filePath)
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function readToml(filePath, fallback = {}) {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    return TOML.parse(content)
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return structuredClone(fallback)
    }

    throw new Error(`无法读取 TOML 文件 ${filePath}: ${error.message}`)
  }
}

export async function writeToml(filePath, value) {
  await ensureDirForFile(filePath)
  await backupIfExists(filePath)
  await fs.writeFile(filePath, TOML.stringify(value), 'utf8')
}

export async function readText(filePath, fallback = '') {
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return fallback
    }

    throw new Error(`无法读取文本文件 ${filePath}: ${error.message}`)
  }
}

export async function writeText(filePath, content) {
  await ensureDirForFile(filePath)
  await backupIfExists(filePath)
  await fs.writeFile(filePath, content, 'utf8')
}

export function normalizeUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('域名或 Base URL 不能为空')
  }

  return url.trim().replace(/\/+$/, '')
}

export function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'provider'
}

export function parseEnv(content) {
  const result = {}

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const index = line.indexOf('=')
    if (index === -1) {
      continue
    }

    const key = line.slice(0, index).trim()
    const value = line.slice(index + 1).trim()
    result[key] = value
  }

  return result
}

export function serializeEnv(envObject) {
  const keys = Object.keys(envObject).sort()
  return `${keys.map((key) => `${key}=${envObject[key] ?? ''}`).join('\n')}\n`
}

export function toolToSelection(tool) {
  if (!tool || tool === 'all') {
    return 'all'
  }

  return tool
}
