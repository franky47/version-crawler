# Quick Start Guide

Get the Repository Dependency Version Discovery API running in under 5 minutes.

## Prerequisites

- [Bun](https://bun.sh) v1.0 or higher
- Git

## Installation

1. **Clone or navigate to the repository**

   ```bash
   cd /path/to/elysia-bun
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Optional: Configure GitHub token**

   For higher rate limits, create a `.env` file:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and add your GitHub token:

   ```bash
   GITHUB_TOKEN=ghp_your_token_here
   ```

   Get a token at: https://github.com/settings/tokens

## Running the Server

**Development mode** (with auto-reload):

```bash
bun run dev
```

**Production mode**:

```bash
bun start
```

The server will start on `http://localhost:3000`

## Testing the API

### 1. Check the server is running

```bash
curl http://localhost:3000/
```

Expected response:

```json
{
  "service": "Repository Dependency Version Discovery API",
  "version": "1.0.0",
  "usage": "GET /:owner/:repo/:pkg?branch=<branch>"
}
```

### 2. Search for a package (example: find "react" in facebook/react)

```bash
curl http://localhost:3000/facebook/react/react
```

This will return all declarations and resolved versions of React in the React repository.

### 3. Try a specific branch

```bash
curl "http://localhost:3000/facebook/react/react?branch=main"
```

### 4. Search for a scoped package

```bash
curl http://localhost:3000/vercel/next.js/@swc/helpers
```

## Understanding the Response

```json
{
  "repo": "facebook/react",
  "pkg": "react",
  "sources": [
    {
      "path": "package.json",
      "type": "manifest",
      "dependencyType": "dependencies",
      "version": "^18.0.0",
      "lineUrl": "https://github.com/facebook/react/blob/main/package.json#L42"
    }
  ]
}
```

- **repo**: The repository that was scanned
- **pkg**: The package that was searched for
- **sources**: Array of all locations where the package was found
  - **path**: File path within the repository
  - **type**: Either "manifest" (package.json) or "lockfile"
  - **dependencyType**: Type of dependency (dependencies, devDependencies, etc.)
  - **version**: The version range or resolved version
  - **lineUrl**: Direct link to the line in GitHub

## Running Tests

```bash
bun test
```

This runs:

- Unit tests (validation, parsing)
- Integration tests (with mocked GitHub API)
- End-to-end tests

## Common Issues

### Port 3000 already in use

Change the port by setting the `PORT` environment variable:

```bash
PORT=3001 bun run dev
```

### GitHub rate limit exceeded

- Add a `GITHUB_TOKEN` to your `.env` file for higher limits
- Wait for the rate limit to reset (shown in the error message)

### Module not found errors

```bash
bun install
```

## Next Steps

- Read the [full README](./README-API.md) for detailed documentation
- Check out [ARCHITECTURE.md](./ARCHITECTURE.md) to understand the system design
- Review the [PRD](./prd.md) for complete specifications
- Run `./examples.sh` to see more usage examples

## Development Tips

### Watch mode

The dev script uses `--watch` which auto-reloads on file changes:

```bash
bun run dev
```

### Debug logging

Enable detailed logs:

```bash
LOG_LEVEL=debug bun run dev
```

### Testing with real repositories

The integration tests use mocks, but you can test against real repos:

```bash
# Test with a small repo first
curl http://localhost:3000/prettier/prettier/prettier

# Then try larger repos
curl http://localhost:3000/facebook/react/react
curl http://localhost:3000/microsoft/TypeScript/typescript
```

## Support

- Issues: Check [GitHub Issues](https://github.com/franky47/version-crawler/issues)
- Documentation: See README-API.md
- Architecture: See ARCHITECTURE.md
