import { logger } from './logger'
import type { DependencySource, DependencyType } from './types'

type PackageJson = {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

export class ManifestParser {
  /**
   * Finds the line number of a dependency declaration in package.json text
   */
  private findLineNumber(
    content: string,
    packageName: string,
    dependencyType: string
  ): number {
    const lines = content.split('\n')
    let inSection = false
    let sectionStarted = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      // Check if we're entering the target dependency section
      if (
        trimmed.startsWith(`"${dependencyType}"`) ||
        trimmed.startsWith(`'${dependencyType}'`)
      ) {
        inSection = true
        sectionStarted = true
        continue
      }

      // If we're in the section, look for the package
      if (inSection) {
        // Check if we've left the section (another top-level key or closing brace)
        if (
          sectionStarted &&
          trimmed.startsWith('"') &&
          !trimmed.includes(':')
        ) {
          break
        }
        if (trimmed === '}' || trimmed === '},') {
          inSection = false
          sectionStarted = false
          continue
        }

        // Look for the package name
        if (
          (trimmed.startsWith(`"${packageName}"`) ||
            trimmed.startsWith(`'${packageName}'`)) &&
          trimmed.includes(':')
        ) {
          return i + 1 // 1-indexed
        }
      }
    }

    return 1 // Fallback to line 1 if not found
  }

  /**
   * Parses a package.json file and extracts dependency information for a specific package
   */
  async parseManifest(
    content: string,
    packageName: string,
    filePath: string,
    repoUrl: string,
    branch: string
  ): Promise<DependencySource[]> {
    logger.debug({ filePath, packageName }, 'Parsing manifest file')

    let parsed: PackageJson
    try {
      parsed = JSON.parse(content)
    } catch (error) {
      logger.warn({ filePath, error }, 'Failed to parse package.json')
      return []
    }

    const sources: DependencySource[] = []
    const dependencyTypes: Array<keyof PackageJson> = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ]

    for (const depType of dependencyTypes) {
      const deps = parsed[depType]
      if (!deps || !(packageName in deps)) {
        continue
      }

      const version = deps[packageName]
      const lineNumber = this.findLineNumber(content, packageName, depType)
      const lineUrl = `${repoUrl}/blob/${branch}/${filePath}#L${lineNumber}`

      sources.push({
        path: filePath,
        type: 'manifest',
        dependencyType: depType as DependencyType,
        version,
        lineUrl,
      })

      logger.debug(
        { filePath, depType, version, lineNumber },
        'Found dependency in manifest'
      )
    }

    return sources
  }

  /**
   * Identifies if a path is a package.json file
   */
  isManifestFile(path: string): boolean {
    return path.endsWith('package.json')
  }
}
