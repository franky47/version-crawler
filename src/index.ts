import { openapi } from '@elysiajs/openapi'
import { Elysia } from 'elysia'
import packageJson from '../package.json' assert { type: 'json' }
import { generateCacheKey, responseCache } from './cache'
import { GitHubApiError, GitHubClient } from './github-client'
import { logger } from './logger'
import { ManifestParser } from './manifest-parser'
import { scanRepository } from './repo-scanner'
import { createTelemetryPlugin } from './telemetry'
import type { ApiResponse } from './types'
import { pathParamsSchema } from './validation'

const githubClient = new GitHubClient()
const manifestParser = new ManifestParser()

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

    if (code === 'VALIDATION') {
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
      const pkg = params['*']

      logger.info({ owner, repo, pkg }, 'Processing request')

      // Check cache first
      const cacheKey = generateCacheKey(owner, repo, pkg)
      const cachedResponse = responseCache.get(cacheKey)
      if (cachedResponse) {
        logger.info({ owner, repo, pkg }, 'Cache hit')
        set.headers['X-Cache'] = 'HIT'
        return cachedResponse
      }

      logger.info({ owner, repo, pkg }, 'Cache miss')
      set.headers['X-Cache'] = 'MISS'

      const sources = await scanRepository({
        owner,
        repo,
        packageName: pkg,
        githubClient,
        manifestParser,
      })

      const response: ApiResponse = {
        repo: `${owner}/${repo}`,
        pkg,
        sources,
      }

      // Store in cache
      responseCache.set(cacheKey, response)

      logger.info(
        { owner, repo, pkg, sourceCount: sources.length },
        'Request completed'
      )

      return response
    },
    {
      params: pathParamsSchema,
      detail: {
        summary: 'Get package versions in a repository',
        description:
          'Retrieve the sources of a specified package version used in a GitHub repository.',
      },
    }
  )

export default app
