import { describe, expect, test } from 'bun:test'
import { ManifestParser } from './manifest-parser'

describe('ManifestParser', () => {
  const parser = new ManifestParser()

  test('should identify package.json files', () => {
    expect(parser.isManifestFile('package.json')).toBe(true)
    expect(parser.isManifestFile('packages/app/package.json')).toBe(true)
    expect(parser.isManifestFile('package-lock.json')).toBe(false)
    expect(parser.isManifestFile('yarn.lock')).toBe(false)
  })

  test('should parse dependencies from package.json', async () => {
    const content = JSON.stringify(
      {
        name: 'test-package',
        dependencies: {
          react: '^18.0.0',
          lodash: '4.17.21',
        },
        devDependencies: {
          typescript: '~5.0.0',
        },
      },
      null,
      2
    )

    const sources = await parser.parseManifest(
      content,
      'react',
      'package.json',
      'https://github.com/test/repo',
      'main'
    )

    expect(sources).toHaveLength(1)
    expect(sources[0].version).toBe('^18.0.0')
    expect(sources[0].dependencyType).toBe('dependencies')
    expect(sources[0].type).toBe('manifest')
  })

  test('should parse devDependencies', async () => {
    const content = JSON.stringify(
      {
        devDependencies: {
          typescript: '~5.0.0',
        },
      },
      null,
      2
    )

    const sources = await parser.parseManifest(
      content,
      'typescript',
      'package.json',
      'https://github.com/test/repo',
      'main'
    )

    expect(sources).toHaveLength(1)
    expect(sources[0].version).toBe('~5.0.0')
    expect(sources[0].dependencyType).toBe('devDependencies')
  })

  test('should parse peerDependencies', async () => {
    const content = JSON.stringify(
      {
        peerDependencies: {
          react: '>=16.0.0',
        },
      },
      null,
      2
    )

    const sources = await parser.parseManifest(
      content,
      'react',
      'package.json',
      'https://github.com/test/repo',
      'main'
    )

    expect(sources).toHaveLength(1)
    expect(sources[0].version).toBe('>=16.0.0')
    expect(sources[0].dependencyType).toBe('peerDependencies')
  })

  test('should parse optionalDependencies', async () => {
    const content = JSON.stringify(
      {
        optionalDependencies: {
          fsevents: '^2.0.0',
        },
      },
      null,
      2
    )

    const sources = await parser.parseManifest(
      content,
      'fsevents',
      'package.json',
      'https://github.com/test/repo',
      'main'
    )

    expect(sources).toHaveLength(1)
    expect(sources[0].version).toBe('^2.0.0')
    expect(sources[0].dependencyType).toBe('optionalDependencies')
  })

  test('should return empty array if package not found', async () => {
    const content = JSON.stringify(
      {
        dependencies: {
          react: '^18.0.0',
        },
      },
      null,
      2
    )

    const sources = await parser.parseManifest(
      content,
      'vue',
      'package.json',
      'https://github.com/test/repo',
      'main'
    )

    expect(sources).toHaveLength(0)
  })

  test('should handle invalid JSON gracefully', async () => {
    const content = 'invalid json {'

    const sources = await parser.parseManifest(
      content,
      'react',
      'package.json',
      'https://github.com/test/repo',
      'main'
    )

    expect(sources).toHaveLength(0)
  })

  test('should generate correct line URLs', async () => {
    const content = `{
  "name": "test",
  "dependencies": {
    "react": "^18.0.0"
  }
}`

    const sources = await parser.parseManifest(
      content,
      'react',
      'packages/app/package.json',
      'https://github.com/test/repo',
      'main'
    )

    expect(sources[0].lineUrl).toContain(
      'https://github.com/test/repo/blob/main/packages/app/package.json#L'
    )
  })

  test('should handle scoped packages', async () => {
    const content = JSON.stringify(
      {
        dependencies: {
          '@types/node': '^20.0.0',
        },
      },
      null,
      2
    )

    const sources = await parser.parseManifest(
      content,
      '@types/node',
      'package.json',
      'https://github.com/test/repo',
      'main'
    )

    expect(sources).toHaveLength(1)
    expect(sources[0].version).toBe('^20.0.0')
  })
})
