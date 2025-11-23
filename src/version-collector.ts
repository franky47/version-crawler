import { logger } from './logger'

const SEMVER_REGEX =
  /^(\^|~|>=?|<=?|=)?\s*\d+(\.\d+)?(\.\d+)?(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/

// Patterns to exclude
const EXCLUDED_PATTERNS = [
  /^workspace:/i,
  /^link:/i,
  /^file:/i,
  /^git\+/i,
  /^https?:\/\//i,
  /^github:/i,
  /^\*/,
  /^latest$/i,
]

export class VersionCollector {
  private versions = new Map<string, Set<string>>()

  /**
   * Validates if a string is a valid semver or semver range
   */
  private isValidSemver(version: string): boolean {
    // Check excluded patterns
    if (EXCLUDED_PATTERNS.some((pattern) => pattern.test(version))) {
      return false
    }

    // Check semver pattern
    return SEMVER_REGEX.test(version)
  }

  /**
   * Normalizes a version string by removing quotes and trimming
   */
  private normalize(version: string): string {
    return version.replace(/^["']|["']$/g, '').trim()
  }

  /**
   * Adds a version to the collection
   */
  add(key: string, version: string): void {
    const normalized = this.normalize(version)

    if (!this.isValidSemver(normalized)) {
      logger.debug({ version: normalized, key }, 'Skipping invalid semver')
      return
    }

    if (!this.versions.has(key)) {
      this.versions.set(key, new Set())
    }

    this.versions.get(key)!.add(normalized)
    logger.debug({ version: normalized, key }, 'Added version')
  }

  /**
   * Gets all versions for a key, sorted
   */
  getVersions(key: string): string[] {
    const versions = this.versions.get(key)
    if (!versions) {
      return []
    }
    return Array.from(versions).sort()
  }

  /**
   * Gets all collected versions across all keys
   */
  getAllVersions(): string[] {
    const allVersions = new Set<string>()
    for (const versions of this.versions.values()) {
      for (const version of versions) {
        allVersions.add(version)
      }
    }
    return Array.from(allVersions).sort()
  }

  /**
   * Clears all collected versions
   */
  clear(): void {
    this.versions.clear()
  }

  /**
   * Gets the number of unique versions collected
   */
  get size(): number {
    return this.getAllVersions().length
  }
}
