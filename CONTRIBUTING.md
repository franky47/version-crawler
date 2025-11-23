# Contributing Guide

## Development Setup

1. **Prerequisites**

   - Bun v1.0+
   - Git
   - Optional: GitHub Personal Access Token

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Run in development mode**
   ```bash
   bun run dev
   ```

## Code Style

### TypeScript

- Use strict mode (enabled in tsconfig.json)
- Prefer interfaces over types for public APIs
- Use explicit return types for public functions
- Avoid `any` - use `unknown` when type is truly unknown

### Naming Conventions

- **Classes**: PascalCase (e.g., `GitHubClient`)
- **Interfaces**: PascalCase with `I` prefix (e.g., `IGitHubClient`)
- **Functions/Methods**: camelCase (e.g., `scanRepository`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `SEMVER_REGEX`)
- **Files**: kebab-case (e.g., `github-client.ts`)

### Logging

Use structured logging with pino:

```typescript
logger.debug({ context }, 'Message')
logger.info({ context }, 'Message')
logger.warn({ context }, 'Message')
logger.error({ context, error }, 'Message')
```

## Testing Guidelines

### Writing Tests

- Use descriptive test names
- Follow AAA pattern: Arrange, Act, Assert
- Use MSW for HTTP mocking
- Avoid testing implementation details

### Test Structure

```typescript
import { describe, expect, test } from 'bun:test'

describe('ComponentName', () => {
  test('should do something specific', () => {
    // Arrange
    const input = 'test'

    // Act
    const result = doSomething(input)

    // Assert
    expect(result).toBe('expected')
  })
})
```

### Running Tests

```bash
# All tests
bun test

# Watch mode
bun test --watch

# Specific file
bun test tests/version-collector.test.ts
```

## Adding New Features

### 1. Add a New Lockfile Format

**Steps**:

1. Add parser in `src/lockfile-parsers.ts`:

   ```typescript
   export async function* findInNewFormatLock(
     response: Response,
     packageName: string
   ): AsyncGenerator<LockfileMatch> {
     // Implementation
   }
   ```

2. Update `parseLockfile()` to handle new format

3. Update `isLockfile()` to recognize new extension

4. Add tests in `tests/lockfile-parsers.test.ts`

### 2. Add New API Endpoint

**Steps**:

1. Define validation schema in `src/validation.ts`
2. Add route handler in `src/index.ts`
3. Update types in `src/types.ts` if needed
4. Add tests in `tests/api.test.ts`
5. Update README-API.md with documentation

### 3. Add New Configuration Option

**Steps**:

1. Add to `.env.example`
2. Document in README-API.md
3. Use `process.env.YOUR_VAR` with fallback
4. Add validation if critical

## Code Review Checklist

Before submitting changes:

- [ ] Code compiles without errors (`bun run src/index.ts`)
- [ ] All tests pass (`bun test`)
- [ ] No TypeScript errors
- [ ] Added tests for new functionality
- [ ] Updated documentation (README, ARCHITECTURE, etc.)
- [ ] Followed code style guidelines
- [ ] Added appropriate logging
- [ ] Considered error handling
- [ ] Performance implications reviewed
- [ ] Security implications reviewed

## Performance Guidelines

### Memory Management

- Use streaming for large files
- Avoid loading entire responses into memory
- Release resources (close streams, cancel requests)
- Monitor memory usage in tests

### Network Efficiency

- Implement early termination in parsers
- Cache when appropriate
- Respect rate limits
- Use parallel requests when possible

### Example: Streaming Parser

```typescript
export async function* streamParse(response: Response) {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        // Process line
        yield processLine(line)
      }
    }
  } finally {
    reader.releaseLock()
  }
}
```

## Error Handling

### Custom Errors

Extend Error class:

```typescript
export class CustomError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message)
    this.name = 'CustomError'
  }
}
```

### Throwing Errors

```typescript
throw new GitHubApiError('Not found', 404)
```

### Catching Errors

```typescript
try {
  await riskyOperation()
} catch (error) {
  logger.error({ error }, 'Operation failed')
  throw new CustomError('Friendly message', 'CODE', error)
}
```

## Documentation

### Code Comments

- Use JSDoc for public APIs
- Explain "why" not "what"
- Keep comments up to date

### Example

```typescript
/**
 * Parses a lockfile and extracts dependency information.
 * Uses streaming to minimize memory usage.
 *
 * @param response - HTTP response with lockfile content
 * @param filePath - Path to lockfile in repository
 * @param packageName - Package to search for
 * @returns Array of dependency sources found
 */
export async function parseLockfile(
  response: Response,
  filePath: string,
  packageName: string
): Promise<DependencySource[]> {
  // Implementation
}
```

## Debugging

### Enable Debug Logs

```bash
LOG_LEVEL=debug bun run dev
```

### Use Debugger

Add breakpoints in VS Code or use:

```typescript
debugger
```

### Inspect Network

Check GitHub API responses:

```typescript
logger.debug({ url, status, headers }, 'GitHub API response')
```

## Common Issues

### Port Already in Use

```bash
PORT=3001 bun run dev
```

### GitHub Rate Limit

Add token to `.env`:

```bash
GITHUB_TOKEN=ghp_your_token_here
```

### Tests Failing

```bash
# Run specific test
bun test tests/specific.test.ts

# Enable debug output
LOG_LEVEL=debug bun test
```

## Release Process

1. Update version in `package.json`
2. Update CHANGELOG.md (if exists)
3. Run full test suite
4. Tag release
5. Deploy

## Resources

- [Bun Documentation](https://bun.sh/docs)
- [Elysia Documentation](https://elysiajs.com)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [Pino Documentation](https://getpino.io)
- [OpenTelemetry Documentation](https://opentelemetry.io)

## Questions?

- Check existing tests for examples
- Review ARCHITECTURE.md for design patterns
- Read the PRD for requirements context
