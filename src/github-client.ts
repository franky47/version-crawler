import { logger } from './logger'
import type {
  GitHubCommit,
  GitHubRepo,
  GitHubTree,
  IGitHubClient,
} from './types'

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: any
  ) {
    super(message)
    this.name = 'GitHubApiError'
  }
}

export class GitHubClient implements IGitHubClient {
  private readonly baseUrl = 'https://api.github.com'
  private readonly rawBaseUrl = 'https://raw.githubusercontent.com'
  private readonly token: string | undefined

  constructor(token?: string) {
    this.token = token || process.env.GITHUB_TOKEN
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'repository-dependency-version-discovery-api',
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    return headers
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining')
    const rateLimitReset = response.headers.get('X-RateLimit-Reset')

    logger.debug(
      {
        status: response.status,
        rateLimitRemaining,
        rateLimitReset,
        url: response.url,
      },
      'GitHub API response'
    )

    if (response.status === 404) {
      throw new GitHubApiError(`Resource not found: ${response.url}`, 404)
    }

    if (response.status === 403 && rateLimitRemaining === '0') {
      const resetTime = rateLimitReset
        ? new Date(parseInt(rateLimitReset) * 1000).toISOString()
        : 'unknown'
      throw new GitHubApiError(
        `GitHub API rate limit exceeded. Resets at ${resetTime}`,
        502
      )
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new GitHubApiError(
        `GitHub API request failed: ${response.statusText}`,
        response.status,
        errorBody
      )
    }

    return response.json()
  }

  async getCommitSha(
    owner: string,
    repo: string,
    ref: string
  ): Promise<string> {
    logger.debug({ owner, repo, ref }, 'Fetching commit SHA')

    const url = `${this.baseUrl}/repos/${owner}/${repo}/commits/${ref}`
    const response = await fetch(url, {
      headers: this.getHeaders(),
    })

    const commit = await this.handleResponse<GitHubCommit>(response)
    return commit.sha
  }

  async getDefaultBranch(owner: string, repo: string): Promise<string> {
    logger.debug({ owner, repo }, 'Fetching default branch')

    const url = `${this.baseUrl}/repos/${owner}/${repo}`
    const response = await fetch(url, {
      headers: this.getHeaders(),
    })

    const repoData = await this.handleResponse<GitHubRepo>(response)
    return repoData.default_branch
  }

  async getTree(owner: string, repo: string, sha: string): Promise<GitHubTree> {
    logger.debug({ owner, repo, sha }, 'Fetching git tree')

    const url = `${this.baseUrl}/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`
    const response = await fetch(url, {
      headers: this.getHeaders(),
    })

    return this.handleResponse<GitHubTree>(response)
  }

  async getRawFileContent(
    owner: string,
    repo: string,
    sha: string,
    path: string
  ): Promise<Response> {
    logger.debug({ owner, repo, sha, path }, 'Fetching raw file content')

    const url = `${this.rawBaseUrl}/${owner}/${repo}/${sha}/${path}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'repository-dependency-version-discovery-api',
      },
    })

    if (!response.ok) {
      throw new GitHubApiError(
        `Failed to fetch raw file: ${response.statusText}`,
        response.status
      )
    }

    return response
  }
}
