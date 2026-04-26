import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

async function runCli(args, homeDir) {
  return execFileAsync('node', ['./bin/hcman.js', ...args], {
    cwd: '/root/hcman',
    env: {
      ...process.env,
      HOME: homeDir
    }
  })
}

test('tool commands manage providers and current selection', async () => {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hcman-cli-'))

  await runCli(['provider', 'add', 'demo', '--api-key', 'sk-demo', '--domain', 'https://demo.example.com'], homeDir)
  const listResult = await runCli(['cx', 'list'], homeDir)
  assert.match(listResult.stdout, /demo/)
  assert.match(listResult.stdout, /https:\/\/demo\.example\.com\/v1/)

  await runCli(['cx', 'use', 'demo'], homeDir)
  const currentResult = await runCli(['cx', 'current'], homeDir)
  assert.match(currentResult.stdout, /Codex: demo/)
  assert.match(currentResult.stdout, /https:\/\/demo\.example\.com\/v1/)

  const authPath = path.join(homeDir, '.codex', 'auth.json')
  const authContent = await fs.readFile(authPath, 'utf8')
  assert.match(authContent, /sk-demo/)
})

test('init writes all tool configs and status reflects current providers', async () => {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hcman-cli-'))

  await runCli(['init', '--name', 'main', '--api-key', 'sk-main'], homeDir)
  const statusResult = await runCli(['status'], homeDir)
  assert.match(statusResult.stdout, /Codex: main/)
  assert.match(statusResult.stdout, /Claude Code: main/)
  assert.match(statusResult.stdout, /Gemini CLI: main/)
  assert.match(statusResult.stdout, /OpenCode: main/)
})

test('hicode shortcut writes only selected tools', async () => {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hcman-cli-'))

  await runCli(['hicode', 'sk-hicode', '--platform', 'codex,gemini'], homeDir)

  const codexAuthPath = path.join(homeDir, '.codex', 'auth.json')
  const geminiEnvPath = path.join(homeDir, '.gemini', '.env')
  const claudePath = path.join(homeDir, '.claude', 'settings.json')

  const codexAuthContent = await fs.readFile(codexAuthPath, 'utf8')
  const geminiEnvContent = await fs.readFile(geminiEnvPath, 'utf8')

  assert.match(codexAuthContent, /sk-hicode/)
  assert.match(geminiEnvContent, /GEMINI_API_KEY=sk-hicode/)
  await assert.rejects(fs.readFile(claudePath, 'utf8'))

  const currentResult = await runCli(['provider', 'current'], homeDir)
  assert.match(currentResult.stdout, /Codex: hicode/)
  assert.match(currentResult.stdout, /Claude Code: 未设置/)
  assert.match(currentResult.stdout, /Gemini CLI: hicode/)
  assert.match(currentResult.stdout, /OpenCode: 未设置/)
})
