import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { GitHubApiError, GitHubClient } from '../src/github-client'

// Mock data
const mockRepo = {
  name: 'react',
  full_name: 'facebook/react',
  default_branch: 'main',
  owner: {
    login: 'facebook',
  },
}

const mockCommit = {
  sha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
  node_id: 'C_test',
  commit: {
    author: {
      name: 'Test Author',
      email: 'test@example.com',
      date: '2024-01-01T00:00:00Z',
    },
    committer: {
      name: 'Test Author',
      email: 'test@example.com',
      date: '2024-01-01T00:00:00Z',
    },
    message: 'Test commit',
    tree: {
      sha: 'tree123',
      url: 'https://api.github.com/repos/facebook/react/git/trees/tree123',
    },
  },
}

const mockTree = {
  sha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
  url: 'https://api.github.com/repos/facebook/react/git/trees/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
  tree: [
    {
      path: 'package.json',
      mode: '100644',
      type: 'blob' as const,
      sha: 'file123',
      size: 1234,
      url: 'https://api.github.com/repos/facebook/react/git/blobs/file123',
    },
    {
      path: 'src',
      mode: '040000',
      type: 'tree' as const,
      sha: 'dir123',
      url: 'https://api.github.com/repos/facebook/react/git/trees/dir123',
    },
  ],
  truncated: false,
}

const mockPackageJson = JSON.stringify(
  {
    name: 'react',
    version: '18.2.0',
    dependencies: {
      'loose-envify': '^1.1.0',
    },
  },
  null,
  2
)

// Set up MSW server
const server = setupServer(
  http.get('https://api.github.com/repos/facebook/react', () => {
    return HttpResponse.json(mockRepo)
  }),
  http.get('https://api.github.com/repos/facebook/react/commits/main', () => {
    return HttpResponse.json(mockCommit)
  }),
  http.get('https://api.github.com/repos/facebook/react/git/trees/:sha', () => {
    return HttpResponse.json(mockTree)
  }),
  http.get(
    'https://raw.githubusercontent.com/facebook/react/:sha/package.json',
    () => {
      return new HttpResponse(mockPackageJson, {
        headers: { 'Content-Type': 'application/json' },
      })
    }
  ),
  http.get(
    'https://api.github.com/repos/facebook/this-repo-definitely-does-not-exist-12345',
    () => {
      return new HttpResponse(null, { status: 404 })
    }
  )
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('GitHub Client Integration', () => {
  const client = new GitHubClient()

  it('should get default branch for a public repo', async () => {
    const defaultBranch = await client.getDefaultBranch('facebook', 'react')
    expect(defaultBranch).toBe('main')
    expect(typeof defaultBranch).toBe('string')
  })

  it('should get commit SHA for a branch', async () => {
    const sha = await client.getCommitSha('facebook', 'react', 'main')
    expect(sha).toBe('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0')
    expect(sha).toMatch(/^[a-f0-9]{40}$/)
  })

  it('should get git tree', async () => {
    const defaultBranch = await client.getDefaultBranch('facebook', 'react')
    const sha = await client.getCommitSha('facebook', 'react', defaultBranch)
    const tree = await client.getTree('facebook', 'react', sha)

    expect(tree).toBeTruthy()
    expect(tree.tree).toBeInstanceOf(Array)
    expect(tree.tree.length).toBe(2)
    expect(tree.tree[0].path).toBe('package.json')
  })

  it('should fetch raw file content', async () => {
    const defaultBranch = await client.getDefaultBranch('facebook', 'react')
    const sha = await client.getCommitSha('facebook', 'react', defaultBranch)
    const response = await client.getRawFileContent(
      'facebook',
      'react',
      sha,
      'package.json'
    )

    expect(response.ok).toBe(true)
    const content = await response.text()
    expect(content).toContain('"name"')
    expect(content).toContain('react')
  })

  it('should throw 404 for non-existent repo', async () => {
    try {
      await client.getDefaultBranch(
        'facebook',
        'this-repo-definitely-does-not-exist-12345'
      )
      expect(false).toBe(true) // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(GitHubApiError)
      expect((error as GitHubApiError).statusCode).toBe(404)
      expect((error as GitHubApiError).message).toContain('Resource not found')
    }
  })
})
