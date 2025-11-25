import { describe, expect, test, beforeEach } from 'bun:test'
import { LRUCache, generateCacheKey } from './cache'

describe('LRUCache', () => {
  let cache: LRUCache<string, number>

  beforeEach(() => {
    cache = new LRUCache<string, number>(3)
  })

  test('should throw error for invalid maxSize', () => {
    expect(() => new LRUCache(0)).toThrow('Cache maxSize must be at least 1')
    expect(() => new LRUCache(-1)).toThrow('Cache maxSize must be at least 1')
  })

  test('should store and retrieve values', () => {
    cache.set('a', 1)
    expect(cache.get('a')).toBe(1)
  })

  test('should return undefined for missing keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined()
  })

  test('should track size correctly', () => {
    expect(cache.size).toBe(0)
    cache.set('a', 1)
    expect(cache.size).toBe(1)
    cache.set('b', 2)
    expect(cache.size).toBe(2)
  })

  test('should evict least recently used item when full', () => {
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    // Cache is now full (3 items)
    expect(cache.size).toBe(3)

    // Add a new item, should evict 'a' (least recently used)
    cache.set('d', 4)
    expect(cache.size).toBe(3)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(2)
    expect(cache.get('c')).toBe(3)
    expect(cache.get('d')).toBe(4)
  })

  test('should update LRU order on get', () => {
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)

    // Access 'a' to make it recently used
    cache.get('a')

    // Add new item - should evict 'b' (now least recently used)
    cache.set('d', 4)
    expect(cache.get('a')).toBe(1)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('c')).toBe(3)
    expect(cache.get('d')).toBe(4)
  })

  test('should update existing key without increasing size', () => {
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('a', 10) // Update existing key
    expect(cache.size).toBe(2)
    expect(cache.get('a')).toBe(10)
  })

  test('should check existence with has()', () => {
    cache.set('a', 1)
    expect(cache.has('a')).toBe(true)
    expect(cache.has('b')).toBe(false)
  })

  test('should delete items', () => {
    cache.set('a', 1)
    expect(cache.delete('a')).toBe(true)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.delete('nonexistent')).toBe(false)
  })

  test('should clear all items', () => {
    cache.set('a', 1)
    cache.set('b', 2)
    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.get('a')).toBeUndefined()
  })

  test('should handle maxSize of 1', () => {
    const smallCache = new LRUCache<string, number>(1)
    smallCache.set('a', 1)
    smallCache.set('b', 2)
    expect(smallCache.size).toBe(1)
    expect(smallCache.get('a')).toBeUndefined()
    expect(smallCache.get('b')).toBe(2)
  })
})

describe('generateCacheKey', () => {
  test('should generate correct cache key', () => {
    expect(generateCacheKey('owner', 'repo', 'package')).toBe('owner\0repo\0package')
  })

  test('should handle scoped packages', () => {
    expect(generateCacheKey('owner', 'repo', '@scope/package')).toBe('owner\0repo\0@scope/package')
  })
})
