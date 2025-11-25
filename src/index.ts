import { Elysia } from 'elysia'
import packageJson from '../package.json' with { type: 'json' }
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
  .get('/', () => ({
    service: 'Repository Dependency Version Discovery API',
    version: packageJson.version,
    usage: 'GET /:owner/:repo/:pkg',
  }))
  .get('/metrics', () => {
    const rateLimitInfo = githubClient.getLastRateLimitInfo()
    return {
      github: {
        rateLimit: rateLimitInfo || {
          status: 'No API calls made yet',
        },
      },
    }
  })
  .get('/favicon.ico', ({ set }) => {
    set.headers['Content-Type'] = 'image/svg+xml'
    return FAVICON_SVG
  })
  .get(
    '/:owner/:repo/:pkg',
    async ({ params }) => {
      const { owner, repo, pkg } = params

      logger.info({ owner, repo, pkg }, 'Processing request')

      // Check cache first
      const cacheKey = generateCacheKey(owner, repo, pkg)
      const cachedResponse = responseCache.get(cacheKey)
      if (cachedResponse) {
        logger.info({ owner, repo, pkg }, 'Cache hit')
        return cachedResponse
      }

      logger.info({ owner, repo, pkg }, 'Cache miss')

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
    }
  )

export default app
