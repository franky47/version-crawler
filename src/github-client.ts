import { type } from 'arktype'
import { logger } from './logger'
import type {
  GitHubCommit,
  GitHubRepo,
  GitHubTree,
  IGitHubClient,
} from './types'
import { rateLimitHeaderSchema, type RateLimitInfo } from './validation'

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
  private lastRateLimitInfo: RateLimitInfo | null = null

  constructor(token?: string) {
    this.token = token || process.env.GITHUB_TOKEN
  }

  getLastRateLimitInfo(): RateLimitInfo | null {
    return this.lastRateLimitInfo
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
    // Capture and validate rate limit headers for observability
    const rawRateLimitData = {
      limit: response.headers.get('X-RateLimit-Limit'),
      remaining: response.headers.get('X-RateLimit-Remaining'),
      reset: response.headers.get('X-RateLimit-Reset'),
      used: response.headers.get('X-RateLimit-Used'),
      resource: response.headers.get('X-RateLimit-Resource'),
    }

    // Validate with ArkType - GitHub API should always return these headers
    const validated = rateLimitHeaderSchema(rawRateLimitData)

    if (validated instanceof type.errors) {
      logger.warn(
        {
          status: response.status,
          rateLimitValidationErrors: validated.summary,
          rawHeaders: rawRateLimitData,
          url: response.url,
        },
        'Failed to validate rate limit headers from GitHub API'
      )
      this.lastRateLimitInfo = null
    } else {
      this.lastRateLimitInfo = validated
      logger.debug(
        {
          status: response.status,
          rateLimit: validated,
          url: response.url,
        },
        'GitHub API response'
      )
    }

    if (response.status === 404) {
      throw new GitHubApiError(`Resource not found: ${response.url}`, 404)
    }

    if (response.status === 403 && this.lastRateLimitInfo?.remaining === 0) {
      const resetTime = this.lastRateLimitInfo.reset
        ? new Date(this.lastRateLimitInfo.reset * 1000).toISOString()
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
