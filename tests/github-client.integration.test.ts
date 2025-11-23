import { describe, expect, it } from 'bun:test'
import { GitHubClient } from '../src/github-client'

// These are smoke tests that hit the real GitHub API
// They help verify the integration works end-to-end
// Set GITHUB_TOKEN env var for higher rate limits

describe('GitHub Client Integration (Smoke Tests)', () => {
  const client = new GitHubClient()

  it(
    'should get default branch for a public repo',
    async () => {
      const defaultBranch = await client.getDefaultBranch('facebook', 'react')
      expect(defaultBranch).toBeTruthy()
      expect(typeof defaultBranch).toBe('string')
    },
    { timeout: 10000 }
  )

  it(
    'should get commit SHA for a branch',
    async () => {
      const sha = await client.getCommitSha('facebook', 'react', 'main')
      expect(sha).toBeTruthy()
      expect(sha).toMatch(/^[a-f0-9]{40}$/)
    },
    { timeout: 10000 }
  )

  it(
    'should get git tree',
    async () => {
      const defaultBranch = await client.getDefaultBranch('facebook', 'react')
      const sha = await client.getCommitSha('facebook', 'react', defaultBranch)
      const tree = await client.getTree('facebook', 'react', sha)

      expect(tree).toBeTruthy()
      expect(tree.tree).toBeInstanceOf(Array)
      expect(tree.tree.length).toBeGreaterThan(0)
    },
    { timeout: 10000 }
  )

  it(
    'should fetch raw file content',
    async () => {
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
    },
    { timeout: 10000 }
  )

  it(
    'should throw 404 for non-existent repo',
    async () => {
      expect(async () => {
        await client.getDefaultBranch(
          'facebook',
          'this-repo-definitely-does-not-exist-12345'
        )
      }).toThrow()
    },
    { timeout: 10000 }
  )
})
