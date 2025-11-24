import { describe, expect, test } from 'bun:test'
import { isLockfile } from '../src/lockfile-parsers'

describe('Lockfile Parsers', () => {
  test('should identify lockfiles', () => {
    expect(isLockfile('package-lock.json')).toBe(true)
    expect(isLockfile('yarn.lock')).toBe(true)
    expect(isLockfile('pnpm-lock.yaml')).toBe(true)
    expect(isLockfile('bun.lock')).toBe(true)
    expect(isLockfile('packages/app/package-lock.json')).toBe(true)
    expect(isLockfile('package.json')).toBe(false)
  })

  // Note: Full streaming parser tests would require mocking Response objects
  // with ReadableStream bodies. These are best tested in integration tests
  // or with actual test fixtures.
})
