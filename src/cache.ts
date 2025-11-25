import type { ApiResponse } from './types'

type CacheEntry<V> = {
  value: V
  expiresAt: number
}

// Default max-age of 1 hour in milliseconds
const DEFAULT_MAX_AGE_MS = 60 * 60 * 1000

/**
 * A simple in-memory LRU (Least Recently Used) cache with TTL support.
 * Uses a Map to maintain insertion order, with most recently used items at the end.
 * Entries expire after the configured max-age (default: 1 hour).
 */
export class LRUCache<K, V> {
  private cache: Map<K, CacheEntry<V>>
  private readonly maxSize: number
  private readonly maxAgeMs: number

  constructor(maxSize: number, maxAgeMs: number = DEFAULT_MAX_AGE_MS) {
    if (maxSize < 1) {
      throw new Error('Cache maxSize must be at least 1')
    }
    this.cache = new Map()
    this.maxSize = maxSize
    this.maxAgeMs = maxAgeMs
  }

  /**
   * Get a value from the cache.
   * If found and not expired, moves the item to the end (most recently used).
   * Expired entries are automatically removed.
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key)
    if (!entry) {
      return undefined
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return undefined
    }

    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)

    return entry.value
  }

  /**
   * Set a value in the cache.
   * If the cache is full, evicts the least recently used item.
   */
  set(key: K, value: V): void {
    // If key exists, delete it first to update its position
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }
    // If at capacity, remove the oldest (first) item
    else if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.maxAgeMs,
    })
  }

  /**
   * Check if a key exists in the cache and is not expired.
   */
  has(key: K): boolean {
    const entry = this.cache.get(key)
    if (!entry) {
      return false
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return false
    }
    return true
  }

  /**
   * Remove a specific key from the cache.
   */
  delete(key: K): boolean {
    return this.cache.delete(key)
  }

  /**
   * Clear all items from the cache.
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get the current size of the cache.
   */
  get size(): number {
    return this.cache.size
  }
}

// Create a singleton cache instance for API responses
// Capped at 1000 items as per requirements
export const responseCache = new LRUCache<string, ApiResponse>(1000)

/**
 * Generate a cache key for the crawling endpoint.
 * Uses null byte as separator since it cannot appear in URL path parameters.
 */
export function generateCacheKey(owner: string, repo: string, pkg: string): string {
  return `${owner}\0${repo}\0${pkg}`
}
