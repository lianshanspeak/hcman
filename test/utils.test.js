import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProvider } from '../src/store.js'
import { parseEnv, serializeEnv, slugify } from '../src/utils.js'

test('buildProvider uses hicode defaults', () => {
  const provider = buildProvider({
    name: 'HiCode Main',
    apiKey: 'sk-test'
  })

  assert.equal(provider.key, 'hicode-main')
  assert.equal(provider.domain, 'https://www.hicode.codes')
  assert.equal(provider.openaiBaseUrl, 'https://www.hicode.codes/v1')
  assert.equal(provider.anthropicBaseUrl, 'https://www.hicode.codes')
  assert.equal(provider.geminiBaseUrl, 'https://www.hicode.codes')
  assert.equal(provider.opencodeBaseUrl, 'https://www.hicode.codes/v1')
})

test('parseEnv and serializeEnv keep key values', () => {
  const env = parseEnv('# comment\nFOO=bar\nBAR=baz\n')
  assert.deepEqual(env, { FOO: 'bar', BAR: 'baz' })
  assert.equal(serializeEnv(env), 'BAR=baz\nFOO=bar\n')
})

test('slugify removes unsupported characters', () => {
  assert.equal(slugify('HiCode Provider #1'), 'hicode-provider-1')
})
