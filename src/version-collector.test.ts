import { describe, expect, test } from 'bun:test'
import { VersionCollector } from './version-collector'

describe('VersionCollector', () => {
  test('should add valid semver versions', () => {
    const collector = new VersionCollector()

    collector.add('test', '^1.2.3')
    collector.add('test', '~2.0.0')
    collector.add('test', '3.0.0')

    const versions = collector.getVersions('test')
    expect(versions).toEqual(['3.0.0', '^1.2.3', '~2.0.0'])
  })

  test('should deduplicate versions', () => {
    const collector = new VersionCollector()

    collector.add('test', '^1.2.3')
    collector.add('test', '^1.2.3')
    collector.add('test', '^1.2.3')

    const versions = collector.getVersions('test')
    expect(versions).toEqual(['^1.2.3'])
  })

  test('should reject workspace: references', () => {
    const collector = new VersionCollector()

    collector.add('test', 'workspace:*')
    collector.add('test', 'workspace:^1.0.0')

    const versions = collector.getVersions('test')
    expect(versions).toEqual([])
  })

  test('should reject link: references', () => {
    const collector = new VersionCollector()

    collector.add('test', 'link:../local')

    const versions = collector.getVersions('test')
    expect(versions).toEqual([])
  })

  test('should reject file: references', () => {
    const collector = new VersionCollector()

    collector.add('test', 'file:./vendor/package')

    const versions = collector.getVersions('test')
    expect(versions).toEqual([])
  })

  test('should reject git URLs', () => {
    const collector = new VersionCollector()

    collector.add('test', 'git+https://github.com/user/repo.git')

    const versions = collector.getVersions('test')
    expect(versions).toEqual([])
  })

  test('should reject http URLs', () => {
    const collector = new VersionCollector()

    collector.add('test', 'https://example.com/package.tgz')

    const versions = collector.getVersions('test')
    expect(versions).toEqual([])
  })

  test('should normalize quoted versions', () => {
    const collector = new VersionCollector()

    collector.add('test', '"1.2.3"')
    collector.add('test', "'2.0.0'")

    const versions = collector.getVersions('test')
    expect(versions).toEqual(['1.2.3', '2.0.0'])
  })

  test('should handle multiple keys', () => {
    const collector = new VersionCollector()

    collector.add('pkg1', '1.0.0')
    collector.add('pkg2', '2.0.0')

    expect(collector.getVersions('pkg1')).toEqual(['1.0.0'])
    expect(collector.getVersions('pkg2')).toEqual(['2.0.0'])
  })

  test('should return empty array for unknown key', () => {
    const collector = new VersionCollector()

    expect(collector.getVersions('unknown')).toEqual([])
  })

  test('should clear all versions', () => {
    const collector = new VersionCollector()

    collector.add('test', '1.0.0')
    collector.clear()

    expect(collector.getVersions('test')).toEqual([])
    expect(collector.size).toBe(0)
  })
})
