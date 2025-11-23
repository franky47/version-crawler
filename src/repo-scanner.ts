import { isLockfile, parseLockfile } from './lockfile-parsers'
import { logger } from './logger'
import { ManifestParser } from './manifest-parser'
import type { DependencySource, IGitHubClient } from './types'

type ScanRepositoryParams = {
  owner: string
  repo: string
  packageName: string
  branch?: string
  githubClient: IGitHubClient
  manifestParser: ManifestParser
}

export async function scanRepository({
  owner,
  repo,
  packageName,
  branch,
  githubClient,
  manifestParser,
}: ScanRepositoryParams): Promise<DependencySource[]> {
  logger.info({ owner, repo, packageName, branch }, 'Starting repository scan')

  // Step 1: Determine the commit SHA to use
  let commitSha: string
  let actualBranch: string

  if (branch) {
    commitSha = await githubClient.getCommitSha(owner, repo, branch)
    actualBranch = branch
  } else {
    actualBranch = await githubClient.getDefaultBranch(owner, repo)
    commitSha = await githubClient.getCommitSha(owner, repo, actualBranch)
  }

  logger.debug({ commitSha, branch: actualBranch }, 'Resolved commit SHA')

  // Step 2: Fetch the git tree recursively
  const tree = await githubClient.getTree(owner, repo, commitSha)

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
        commitSha,
        filePath
      )
      const content = await response.text()

      const manifestSources = await manifestParser.parseManifest(
        content,
        packageName,
        filePath,
        repoUrl,
        actualBranch
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
        commitSha,
        filePath
      )

      const lockfileSources = await parseLockfile(
        response,
        filePath,
        packageName,
        repoUrl,
        actualBranch
      )

      sources.push(...lockfileSources)
    } catch (error) {
      logger.error({ filePath, error }, 'Failed to parse lockfile')
    }
  }

  logger.info({ totalSources: sources.length }, 'Completed repository scan')

  return sources
}
