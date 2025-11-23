# Repository Dependency Version Discovery API

A Bun + Elysia API service that discovers all declared dependency version ranges for a given npm package within a GitHub repository, without cloning the repository.

## Features

- 🔍 Discovers all version ranges of an npm package in a GitHub repository
- 📦 Supports multiple package managers: npm, yarn, pnpm, and bun
- 🚀 Streaming parsers for memory-efficient processing of large lockfiles
- 🔒 No repository cloning required - uses GitHub API only
- 📊 Returns sources from both manifests (package.json) and lockfiles
- ⚡ Built with Bun and Elysia for high performance
- 🔭 OpenTelemetry support for observability
- ✅ Comprehensive test coverage with MSW

## Installation

```bash
bun install
```

## Configuration

Create a `.env` file (optional):

```bash
# Optional: GitHub Personal Access Token for higher rate limits
GITHUB_TOKEN=ghp_your_token_here

# Optional: OpenTelemetry endpoint for tracing
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces

# Optional: Server port (defaults to 3000)
PORT=3000

# Optional: Log level (defaults to 'info')
LOG_LEVEL=debug
```

## Usage

### Start the server

Development mode with auto-reload:

```bash
bun run dev
```

Production mode:

```bash
bun start
```

### API Endpoint

```
GET /:owner/:repo/:pkg?branch=<branch>
```

**Path Parameters:**

- `owner` - GitHub repository owner (username or organization)
- `repo` - GitHub repository name
- `pkg` - npm package name to search for (supports scoped packages)

**Query Parameters:**

- `branch` (optional) - Specific branch or tag to search (defaults to repository's default branch)

### Examples

Find all versions of `react` in the `facebook/react` repository:

```bash
curl http://localhost:3000/facebook/react/react
```

Find all versions of `typescript` in a specific branch:

```bash
curl "http://localhost:3000/microsoft/TypeScript/typescript?branch=main"
```

Find a scoped package:

```bash
curl http://localhost:3000/vercel/next.js/@next/swc
```

### Response Format

```json
{
  "repo": "owner/repo",
  "pkg": "package-name",
  "sources": [
    {
      "path": "package.json",
      "type": "manifest",
      "dependencyType": "dependencies",
      "version": "^1.0.0",
      "lineUrl": "https://github.com/owner/repo/blob/main/package.json#L15"
    },
    {
      "path": "pnpm-lock.yaml",
      "type": "lockfile",
      "dependencyType": "resolved",
      "version": "1.0.5",
      "lineUrl": "https://github.com/owner/repo/blob/main/pnpm-lock.yaml#L450"
    }
  ]
}
```

## Testing

Run all tests:

```bash
bun test
```

The test suite includes:

- Unit tests for version validation and normalization
- Unit tests for manifest parsing
- Integration tests with mocked GitHub API (using MSW)
- End-to-end API tests

## Architecture

### Components

- **GitHubClient** - Handles GitHub API requests with rate limit management
- **RepoScanner** - Orchestrates the scanning process
- **ManifestParser** - Parses package.json files with line number tracking
- **LockfileStreamers** - Memory-efficient streaming parsers for various lockfile formats
- **VersionCollector** - Validates and deduplicates semver ranges

### Supported Files

**Manifests:**

- `package.json` (all dependency types)

**Lockfiles:**

- `package-lock.json` (npm)
- `yarn.lock` (Yarn v1 and Berry)
- `pnpm-lock.yaml` (pnpm)
- `bun.lock` (Bun text format)

## Performance

- Memory usage: < 5MB per request
- Response time: < 1.5s for typical repositories
- Streaming parsers prevent loading entire lockfiles into memory
- Supports large monorepos efficiently

## Error Handling

| Status Code | Description                    |
| ----------- | ------------------------------ |
| 200         | Success                        |
| 400         | Invalid input parameters       |
| 404         | Repository not found           |
| 502         | GitHub API rate limit exceeded |
| 500         | Internal server error          |

## Development

This project was created using `bun init` in bun v1.1.42. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

## License

MIT
