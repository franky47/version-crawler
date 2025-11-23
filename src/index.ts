import { Elysia } from 'elysia'
import { GitHubApiError, GitHubClient } from './github-client'
import { logger } from './logger'
import { RepoScanner } from './repo-scanner'
import { createTelemetryPlugin } from './telemetry'
import type { ApiResponse } from './types'
import { pathParamsSchema, queryParamsSchema } from './validation'

const PORT = process.env.PORT || 3000

const app = new Elysia()
  .use(createTelemetryPlugin())
  .onError(({ code, error, set }) => {
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
      set.status = 404
      return {
        error: 'Not found',
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
    version: '1.0.0',
    usage: 'GET /:owner/:repo/:pkg?branch=<branch>',
  }))
  .get(
    '/:owner/:repo/:pkg',
    async ({ params, query }) => {
      const { owner, repo, pkg } = params
      const { branch } = query

      logger.info({ owner, repo, pkg, branch }, 'Processing request')

      const githubClient = new GitHubClient()
      const scanner = new RepoScanner(githubClient)

      const sources = await scanner.scanRepository(owner, repo, pkg, branch)

      const response: ApiResponse = {
        repo: `${owner}/${repo}`,
        pkg,
        sources,
      }

      logger.info(
        { owner, repo, pkg, sourceCount: sources.length },
        'Request completed'
      )

      return response
    },
    {
      params: pathParamsSchema,
      query: queryParamsSchema,
    }
  )

export default app
