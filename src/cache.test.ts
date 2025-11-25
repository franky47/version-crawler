import { describe, expect, test, beforeEach, mock } from 'bun:test'
import { LRUCache, generateCacheKey, type TimeProvider } from './cache'

/**
 * Creates a mock time provider for testing
 */
function createMockTimeProvider(initialTime: number = 0): TimeProvider & { advance: (ms: number) => void; setTime: (time: number) => void } {
  let currentTime = initialTime
  return {
    now: () => currentTime,
    advance: (ms: number) => { currentTime += ms },
    setTime: (time: number) => { currentTime = time },
  }
}

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

  test('should NOT update LRU order on has()', () => {
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)

    // Check 'a' with has() - should NOT make it recently used
    expect(cache.has('a')).toBe(true)

    // Add new item - should still evict 'a' (still least recently used)
    cache.set('d', 4)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(2)
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

  test('should expire entries after max-age', () => {
    const mockTime = createMockTimeProvider(1000)
    const ttlCache = new LRUCache<string, number>(3, 100, mockTime)

    ttlCache.set('a', 1)
    expect(ttlCache.get('a')).toBe(1)

    // Advance time past expiration (101ms)
    mockTime.advance(101)
    expect(ttlCache.get('a')).toBeUndefined()
  })

  test('should return false for has() on expired entries', () => {
    const mockTime = createMockTimeProvider(1000)
    const ttlCache = new LRUCache<string, number>(3, 100, mockTime)

    ttlCache.set('a', 1)
    expect(ttlCache.has('a')).toBe(true)

    // Advance time past expiration
    mockTime.advance(101)
    expect(ttlCache.has('a')).toBe(false)
  })

  test('should use default max-age of 1 hour', () => {
    const mockTime = createMockTimeProvider(1000)
    const defaultCache = new LRUCache<string, number>(3, undefined, mockTime)

    defaultCache.set('a', 1)
    expect(defaultCache.get('a')).toBe(1)

    // Advance time just under 1 hour (59 minutes)
    mockTime.advance(59 * 60 * 1000)
    expect(defaultCache.get('a')).toBe(1)

    // Advance time past 1 hour total (2 more minutes)
    mockTime.advance(2 * 60 * 1000)
    expect(defaultCache.get('a')).toBeUndefined()
  })
})

describe('generateCacheKey', () => {
  test('should generate correct cache key', () => {
    expect(generateCacheKey('owner', 'repo', 'package')).toBe('owner\0repo\0package')
  })

  test('should handle scoped packages', () => {
    expect(generateCacheKey('owner', 'repo', '@scope/package')).toBe('owner\0repo\0@scope/package')
  })

  test('should not have collisions between different parameter combinations', () => {
    // Test the specific collision case mentioned in the review
    const key1 = generateCacheKey('abc', 'def', 'ghi')
    const key2 = generateCacheKey('ab', 'cde', 'fghi')
    expect(key1).not.toBe(key2)
    
    // Verify they produce distinct keys
    expect(key1).toBe('abc\0def\0ghi')
    expect(key2).toBe('ab\0cde\0fghi')
  })
})
