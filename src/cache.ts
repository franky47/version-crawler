import type { ApiResponse } from './types'

/**
 * A simple in-memory LRU (Least Recently Used) cache.
 * Uses a Map to maintain insertion order, with most recently used items at the end.
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>
  private readonly maxSize: number

  constructor(maxSize: number) {
    this.cache = new Map()
    this.maxSize = maxSize
  }

  /**
   * Get a value from the cache.
   * If found, moves the item to the end (most recently used).
   */
  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined
    }

    // Move to end (most recently used)
    const value = this.cache.get(key)!
    this.cache.delete(key)
    this.cache.set(key, value)

    return value
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

    this.cache.set(key, value)
  }

  /**
   * Check if a key exists in the cache.
   */
  has(key: K): boolean {
    return this.cache.has(key)
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
 */
export function generateCacheKey(owner: string, repo: string, pkg: string): string {
  return `${owner}/${repo}/${pkg}`
}
