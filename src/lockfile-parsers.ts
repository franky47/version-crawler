import { logger } from './logger'
import type { DependencySource } from './types'

export interface LockfileMatch {
  version: string
  lineNumber: number
}

/**
 * Streams through npm package-lock.json looking for a specific package
 * Returns resolved versions found
 */
export async function* findInNpmLock(
  response: Response,
  packageName: string
): AsyncGenerator<LockfileMatch> {
  logger.debug({ packageName }, 'Streaming npm lock file')

  if (!response.body) {
    logger.warn('No response body for npm lock')
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let lineNumber = 1
  let inPackageBlock = false
  let bracketDepth = 0

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || ''

      for (const line of lines) {
        lineNumber++

        // Look for the package in "node_modules/package-name" or "packages/name/node_modules/package"
        if (
          line.includes(`"node_modules/${packageName}"`) ||
          line.includes(`"${packageName}"`)
        ) {
          inPackageBlock = true
          bracketDepth = 0
        }

        if (inPackageBlock) {
          // Track bracket depth to know when we exit the package block
          for (const char of line) {
            if (char === '{') bracketDepth++
            if (char === '}') bracketDepth--
          }

          // Look for version field
          const versionMatch = line.match(/"version":\s*"([^"]+)"/)
          if (versionMatch) {
            yield {
              version: versionMatch[1],
              lineNumber,
            }
          }

          // Exit package block when brackets close
          if (bracketDepth <= 0 && line.includes('}')) {
            inPackageBlock = false
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer && inPackageBlock) {
      const versionMatch = buffer.match(/"version":\s*"([^"]+)"/)
      if (versionMatch) {
        yield {
          version: versionMatch[1],
          lineNumber: lineNumber + 1,
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  logger.debug({ packageName }, 'Finished streaming npm lock file')
}

/**
 * Streams through yarn v1 lock file looking for a specific package
 * Yarn v1 format: package-name@version:\n  version "x.y.z"
 */
export async function* findInYarnV1Lock(
  response: Response,
  packageName: string
): AsyncGenerator<LockfileMatch> {
  logger.debug({ packageName }, 'Streaming yarn v1 lock file')

  if (!response.body) {
    logger.warn('No response body for yarn v1 lock')
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let lineNumber = 0
  let inPackageBlock = false

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        lineNumber++

        // Check if this is a package header line
        // Format: "package-name@^1.0.0", package-name@~2.0.0:
        if (
          line.startsWith(packageName + '@') ||
          line.includes(`"${packageName}@`)
        ) {
          inPackageBlock = true
          logger.debug(
            { lineNumber, line: line.trim() },
            'Found package header in yarn v1 lock'
          )
        }

        if (inPackageBlock) {
          // Look for version line
          const versionMatch = line.match(/^\s+version\s+"([^"]+)"/)
          if (versionMatch) {
            yield {
              version: versionMatch[1],
              lineNumber,
            }
            inPackageBlock = false
          }

          // Exit block if we hit an empty line or new package
          if (
            line.trim() === '' ||
            (!line.startsWith(' ') && !line.startsWith('\t'))
          ) {
            inPackageBlock = false
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  logger.debug({ packageName }, 'Finished streaming yarn v1 lock file')
}

/**
 * Streams through pnpm-lock.yaml looking for a specific package
 */
export async function* findInPnpmLock(
  response: Response,
  packageName: string
): AsyncGenerator<LockfileMatch> {
  logger.debug({ packageName }, 'Streaming pnpm lock file')

  if (!response.body) {
    logger.warn('No response body for pnpm lock')
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let lineNumber = 0

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        lineNumber++

        // PNPM format: "  /package-name/1.2.3:"
        // or "  /@scope/package-name/1.2.3:"
        const match = line.match(
          new RegExp(
            `^\\s+[\\/']${packageName.replace(/\//g, '\\/')}[\\/']([^:'"\\s]+)`
          )
        )
        if (match) {
          const versionPart = match[1].replace(/^\//, '')
          // Extract version from path
          const versionMatch = versionPart.match(/^(\d+\.\d+\.\d+[^\/]*)/)
          if (versionMatch) {
            yield {
              version: versionMatch[1],
              lineNumber,
            }
          }
        }

        // Also check for specifiers with version info
        // Format: "    specifier: ^1.0.0"
        if (line.includes(packageName)) {
          const specMatch = line.match(/version:\s*([^\s]+)/)
          if (specMatch) {
            yield {
              version: specMatch[1],
              lineNumber,
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  logger.debug({ packageName }, 'Finished streaming pnpm lock file')
}

/**
 * Streams through bun.lock (text format) looking for a specific package
 */
export async function* findInBunLock(
  response: Response,
  packageName: string
): AsyncGenerator<LockfileMatch> {
  logger.debug({ packageName }, 'Streaming bun lock file')

  if (!response.body) {
    logger.warn('No response body for bun lock')
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let lineNumber = 0

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        lineNumber++

        // Bun lockfile format is similar to yarn
        // Look for package entries
        if (line.includes(packageName)) {
          // Try to extract version
          const versionMatch = line.match(
            /["']?([0-9]+\.[0-9]+\.[0-9]+[^"'\s]*)["']?/
          )
          if (versionMatch) {
            yield {
              version: versionMatch[1],
              lineNumber,
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  logger.debug({ packageName }, 'Finished streaming bun lock file')
}

/**
 * Determines lockfile type and parses it accordingly
 */
export async function parseLockfile(
  response: Response,
  filePath: string,
  packageName: string,
  repoUrl: string,
  branch: string
): Promise<DependencySource[]> {
  const sources: DependencySource[] = []

  let generator: AsyncGenerator<LockfileMatch>

  if (filePath.endsWith('package-lock.json')) {
    generator = findInNpmLock(response, packageName)
  } else if (filePath.endsWith('yarn.lock')) {
    generator = findInYarnV1Lock(response, packageName)
  } else if (filePath.endsWith('pnpm-lock.yaml')) {
    generator = findInPnpmLock(response, packageName)
  } else if (filePath.endsWith('bun.lock')) {
    generator = findInBunLock(response, packageName)
  } else {
    logger.warn({ filePath }, 'Unknown lockfile type')
    return sources
  }

  for await (const match of generator) {
    const lineUrl = `${repoUrl}/blob/${branch}/${filePath}#L${match.lineNumber}`
    sources.push({
      path: filePath,
      type: 'lockfile',
      dependencyType: 'resolved',
      version: match.version,
      lineUrl,
    })

    logger.debug(
      { filePath, version: match.version, lineNumber: match.lineNumber },
      'Found dependency in lockfile'
    )
  }

  return sources
}

/**
 * Identifies if a path is a lockfile
 */
export function isLockfile(path: string): boolean {
  return (
    path.endsWith('package-lock.json') ||
    path.endsWith('yarn.lock') ||
    path.endsWith('pnpm-lock.yaml') ||
    path.endsWith('bun.lock')
  )
}
