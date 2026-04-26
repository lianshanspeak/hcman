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
