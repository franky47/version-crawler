import { isLockfile, parseLockfile } from './lockfile-parsers'
import { logger } from './logger'
import { ManifestParser } from './manifest-parser'
import type { DependencySource, IGitHubClient } from './types'

type ScanRepositoryParams = {
  owner: string
  repo: string
  packageName: string
  githubClient: IGitHubClient
  manifestParser: ManifestParser
}

export async function scanRepository({
  owner,
  repo,
  packageName,
  githubClient,
  manifestParser,
}: ScanRepositoryParams): Promise<DependencySource[]> {
  logger.info({ owner, repo, packageName }, 'Starting repository scan')

  // Step 1: Fetch the git tree recursively from HEAD (default branch)
  const tree = await githubClient.getTree(owner, repo, 'HEAD')

  if (tree.truncated) {
    logger.warn('Git tree was truncated - some files may be missed')
  }

  // Step 3: Identify files of interest
  const manifestFiles: string[] = []
  const lockfiles: string[] = []

  for (const item of tree.tree) {
    if (item.type !== 'blob') {
      continue
    }

    if (manifestParser.isManifestFile(item.path)) {
      manifestFiles.push(item.path)
    } else if (isLockfile(item.path)) {
      lockfiles.push(item.path)
    }
  }

  logger.info(
    { manifestCount: manifestFiles.length, lockfileCount: lockfiles.length },
    'Discovered files to scan'
  )

  const sources: DependencySource[] = []
  const repoUrl = `https://github.com/${owner}/${repo}`

  // Step 4: Parse all manifest files
  for (const filePath of manifestFiles) {
    try {
      const response = await githubClient.getRawFileContent(
        owner,
        repo,
        'HEAD',
        filePath
      )
      const content = await response.text()

      const manifestSources = await manifestParser.parseManifest(
        content,
        packageName,
        filePath,
        repoUrl,
        'HEAD'
      )

      sources.push(...manifestSources)
    } catch (error) {
      logger.error({ filePath, error }, 'Failed to parse manifest file')
    }
  }

  // Step 5: Stream parse all lockfiles
  for (const filePath of lockfiles) {
    try {
      const response = await githubClient.getRawFileContent(
        owner,
        repo,
        'HEAD',
        filePath
      )

      const lockfileSources = await parseLockfile(
        response,
        filePath,
        packageName,
        repoUrl,
        'HEAD'
      )

      sources.push(...lockfileSources)
    } catch (error) {
      logger.error({ filePath, error }, 'Failed to parse lockfile')
    }
  }

  logger.info({ totalSources: sources.length }, 'Completed repository scan')

  return sources
}
