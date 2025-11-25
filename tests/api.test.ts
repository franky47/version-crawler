import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import app from '../src/index'

// Mock GitHub API responses
const mockTree = {
  sha: 'abc123',
  url: 'https://api.github.com/repos/test-owner/test-repo/git/trees/abc123',
  tree: [
    {
      path: 'package.json',
      mode: '100644',
      type: 'blob' as const,
      sha: 'def456',
      size: 100,
      url: 'https://api.github.com/repos/test-owner/test-repo/git/blobs/def456',
    },
  ],
  truncated: false,
}

const mockPackageJson = JSON.stringify(
  {
    name: 'test-repo',
    dependencies: {
      react: '^18.0.0',
    },
  },
  null,
  2
)

// Set up MSW server
const server = setupServer(
  http.get(
    'https://api.github.com/repos/:owner/:repo/git/trees/:sha',
    ({ params }) => {
      // Support both HEAD and specific SHA for backward compatibility
      return HttpResponse.json(mockTree, {
        headers: {
          'X-RateLimit-Limit': '5000',
          'X-RateLimit-Remaining': '4999',
          'X-RateLimit-Reset': '1732492800',
          'X-RateLimit-Used': '1',
          'X-RateLimit-Resource': 'core',
        },
      })
    }
  ),
  http.get('https://raw.githubusercontent.com/:owner/:repo/:sha/:path', () => {
    return new HttpResponse(mockPackageJson, {
      headers: { 'Content-Type': 'application/json' },
    })
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

test('GET / returns service info', async () => {
  const response = await app.handle(new Request('http://localhost:3000/'))
  expect(response.status).toBe(200)

  const data = await response.json()
  expect(data).toHaveProperty('service')
  expect(data).toHaveProperty('version')
  expect(data).toHaveProperty('examples')
  expect(Array.isArray(data.examples)).toBe(true)
  expect(data.examples.length).toBe(3)
})

test('GET /:owner/:repo/:pkg returns dependency information', async () => {
  const response = await app.handle(
    new Request('http://localhost:3000/test-owner/test-repo/react')
  )

  expect(response.status).toBe(200)
  const data = await response.json()

  expect(data).toHaveProperty('repo', 'test-owner/test-repo')
  expect(data).toHaveProperty('pkg', 'react')
  expect(data).toHaveProperty('sources')
  expect(Array.isArray(data.sources)).toBe(true)
})

test('GET /:owner/:repo/:pkg with invalid owner returns 400', async () => {
  const response = await app.handle(
    new Request('http://localhost:3000/invalid@owner/test-repo/react')
  )

  expect(response.status).toBe(400)
})

test('GET /:owner/:repo/:pkg with 404 from GitHub returns 404', async () => {
  server.use(
    http.get('https://api.github.com/repos/:owner/:repo/git/trees/:sha', () => {
      return new HttpResponse(null, { status: 404 })
    })
  )

  const response = await app.handle(
    new Request('http://localhost:3000/test-owner/nonexistent/react')
  )

  expect(response.status).toBe(404)
})

test('GET /:owner/:repo/:pkg with rate limit returns 502', async () => {
  server.use(
    http.get('https://api.github.com/repos/:owner/:repo/git/trees/:sha', () => {
      return new HttpResponse(null, {
        status: 403,
        headers: {
          'X-RateLimit-Limit': '5000',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': '1234567890',
          'X-RateLimit-Used': '5000',
          'X-RateLimit-Resource': 'core',
        },
      })
    })
  )

  const response = await app.handle(
    new Request('http://localhost:3000/test-owner/test-repo/react')
  )

  expect(response.status).toBe(502)
})

test('GET /metrics returns GitHub rate limit info', async () => {
  // First make a request to populate rate limit info
  await app.handle(
    new Request('http://localhost:3000/test-owner/test-repo/react')
  )

  // Then check metrics endpoint
  const response = await app.handle(
    new Request('http://localhost:3000/metrics')
  )
  expect(response.status).toBe(200)

  const data = await response.json()
  expect(data).toHaveProperty('github')
  expect(data.github).toHaveProperty('rateLimit')

  // Should have rate limit info from the previous request
  if (data.github.rateLimit.status !== 'No API calls made yet') {
    expect(data.github.rateLimit).toHaveProperty('limit')
    expect(data.github.rateLimit).toHaveProperty('remaining')
    expect(data.github.rateLimit).toHaveProperty('reset')
    expect(data.github.rateLimit).toHaveProperty('used')
    expect(data.github.rateLimit).toHaveProperty('resource')
  }
})

test('GET /favicon.ico returns SVG with robot emoji', async () => {
  const response = await app.handle(
    new Request('http://localhost:3000/favicon.ico')
  )
  expect(response.status).toBe(200)
  expect(response.headers.get('Content-Type')).toBe('image/svg+xml')

  const svg = await response.text()
  expect(svg).toContain('<svg')
  expect(svg).toContain('🤖')
})
