import { openapi } from '@elysiajs/openapi'
import { type } from 'arktype'
import { Elysia } from 'elysia'
import packageJson from '../package.json' assert { type: 'json' }
import { generateCacheKey, responseCache } from './cache'
import { GitHubApiError, GitHubClient } from './github-client'
import { logger } from './logger'
import { ManifestParser } from './manifest-parser'
import { scanRepository } from './repo-scanner'
import { createTelemetryPlugin } from './telemetry'
import type { ApiResponse } from './types'
import {
  ownerSchemaArkType,
  packageSchemaArkType,
  repoSchemaArkType,
  wildcardPathParamsSchema,
} from './validation'

const githubClient = new GitHubClient()
const manifestParser = new ManifestParser()

/**
 * Custom error for validation failures
 */
class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Shared business logic for handling package version requests.
 * Handles caching, repository scanning, and response generation.
 */
async function handlePackageVersionRequest(
  owner: string,
  repo: string,
  packageName: string,
  set: any
): Promise<ApiResponse> {
  logger.info({ owner, repo, packageName }, 'Processing request')

  // Check cache first
  const cacheKey = generateCacheKey(owner, repo, packageName)
  const cachedResponse = responseCache.get(cacheKey)
  if (cachedResponse) {
    logger.info({ owner, repo, packageName }, 'Cache hit')
    set.headers['X-Cache'] = 'HIT'
    return cachedResponse
  }

  logger.info({ owner, repo, packageName }, 'Cache miss')
  set.headers['X-Cache'] = 'MISS'

  const sources = await scanRepository({
    owner,
    repo,
    packageName,
    githubClient,
    manifestParser,
  })

  const response: ApiResponse = {
    repo: `${owner}/${repo}`,
    pkg: packageName,
    sources,
  }

  // Store in cache
  responseCache.set(cacheKey, response)

  logger.info(
    { owner, repo, packageName, sourceCount: sources.length },
    'Request completed'
  )

  return response
}

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">🤖</text></svg>`

const app = new Elysia()
  .use(createTelemetryPlugin())
  .use(
    openapi({
      path: '/docs',
      documentation: {
        info: {
          title: packageJson.name,
          version: packageJson.version,
          description: packageJson.description,
        },
      },
    })
  )
  .onError(({ code, error, set, request }) => {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    logger.error(
      { code, error: errorMessage, stack: errorStack },
      'Request error'
    )

    if (error instanceof GitHubApiError) {
      set.status = error.statusCode
      return {
        error: error.message,
        statusCode: error.statusCode,
      }
    }

    if (error instanceof ValidationError || code === 'VALIDATION') {
      set.status = 400
      return {
        error: 'Validation failed',
        message: errorMessage,
        statusCode: 400,
      }
    }

    if (code === 'NOT_FOUND') {
      const requestPath = new URL(request.url).pathname
      logger.error({ path: requestPath }, 'Resource not found')
      set.status = 404
      return {
        error: 'Not found',
        path: requestPath,
        statusCode: 404,
      }
    }

    // Default to 500 for unexpected errors
    set.status = 500
    return {
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'production' ? undefined : errorMessage,
      statusCode: 500,
    }
  })
  .get(
    '/',
    () => ({
      service: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      usage: 'GET /:owner/:repo/:pkg',
      documentation: 'https://version-crawler.47ng.com/docs',
      examples: [
        'https://version-crawler.47ng.com/Microsoft/vscode/typescript',
        'https://version-crawler.47ng.com/Vercel/next.js/react',
        'https://version-crawler.47ng.com/shadcn/ui/tailwindcss',
      ],
      deployment: process.env.CC_DEPLOYMENT_ID ?? 'local',
      sha1: process.env.CC_COMMIT_ID ?? null,
    }),
    {
      detail: {
        summary: 'API Root Endpoint',
        description: 'For demos and usage information.',
      },
    }
  )
  .get(
    '/metrics',
    () => {
      const rateLimitInfo = githubClient.getLastRateLimitInfo()
      return {
        github: {
          rateLimit: rateLimitInfo || {
            status: 'No API calls made yet',
          },
        },
      }
    },
    {
      detail: {
        hide: true,
      },
    }
  )
  .get('/favicon.ico', ({ set }) => {
    set.headers['Content-Type'] = 'image/svg+xml'
    return FAVICON_SVG
  })
  .get(
    '/:owner/:repo/*',
    async ({ params, set }) => {
      const { owner, repo } = params
      const wildcardPart = params['*'] as string
      
      // The wildcard captures the package name, which can be:
      // - Unscoped: "react" -> packageName = "react"
      // - Scoped: "@tanstack/react-query" -> packageName = "@tanstack/react-query"
      const packageName = wildcardPart
      
      // Validate owner and repo
      const ownerValidation = ownerSchemaArkType(owner)
      const repoValidation = repoSchemaArkType(repo)
      
      if (ownerValidation instanceof type.errors) {
        throw new ValidationError('Invalid owner name. Must contain only alphanumeric characters and hyphens.')
      }
      
      if (repoValidation instanceof type.errors) {
        throw new ValidationError('Invalid repository name. Must contain only alphanumeric characters, hyphens, periods, and underscores.')
      }
      
      // Validate package name (supports both scoped and unscoped)
      const packageValidation = packageSchemaArkType(packageName)
      
      if (packageValidation instanceof type.errors) {
        throw new ValidationError(
          'Invalid package name. Must be alphanumeric with optional scope (@scope/package).'
        )
      }
      
      return handlePackageVersionRequest(owner, repo, packageName, set)
    },
    {
      detail: {
        summary: 'Get package versions in a repository',
        description:
          'Retrieve the sources of a specified package version used in a GitHub repository. Supports both unscoped packages (/:owner/:repo/pkg) and scoped packages (/:owner/:repo/@scope/package).',
      },
    }
  )

export default app
