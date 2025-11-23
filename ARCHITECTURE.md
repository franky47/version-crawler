# Architecture Overview

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│                         Client                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP GET /:owner/:repo/:pkg
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Elysia API Server                        │
│  ┌───────────────────────────────────────────────────┐      │
│  │  Request Handler                                  │      │
│  │  - Input Validation (ArkType)                     │      │
│  │  - Error Handling                                 │      │
│  │  - OpenTelemetry Tracing                          │      │
│  └───────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      RepoScanner                            │
│  - Orchestrates the scanning workflow                       │
│  - Determines commit SHA and branch                         │
│  - Fetches git tree recursively                             │
│  - Identifies files of interest                             │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
┌───────────────────────────┐  ┌───────────────────────────┐
│   ManifestParser          │  │   LockfileStreamers       │
│                           │  │                           │
│  - Parses package.json    │  │  - npm (package-lock)     │
│  - Extracts dependencies  │  │  - Yarn v1 & Berry        │
│  - Tracks line numbers    │  │  - pnpm (pnpm-lock.yaml)  │
│  - Supports all dep types │  │  - Bun (bun.lock)         │
│                           │  │                           │
│  Returns:                 │  │  Streaming with:          │
│  - path                   │  │  - Early termination      │
│  - type: 'manifest'       │  │  - Memory bounded         │
│  - dependencyType         │  │  - Line number tracking   │
│  - version                │  │                           │
│  - lineUrl                │  │  Returns same format      │
└───────────────────────────┘  └───────────────────────────┘
                │                           │
                └─────────────┬─────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   VersionCollector                          │
│  - Validates semver patterns                                │
│  - Filters out non-semver (workspace:, link:, etc.)         │
│  - Deduplicates versions                                    │
│  - Normalizes version strings                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Aggregated Response                        │
│  {                                                          │
│    repo: "owner/repo",                                      │
│    pkg: "package-name",                                     │
│    sources: [ ... ]                                         │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

## External Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│                      GitHub API                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ GET /repos/  │  │ GET /commits │  │ GET /trees   │       │
│  │ :owner/:repo │  │              │  │  ?recursive  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    GitHubClient                             │
│  - Authentication (GITHUB_TOKEN)                            │
│  - Rate limit handling                                      │
│  - Error mapping                                            │
│  - Response streaming                                       │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Request Phase

```
Client Request
    ↓
Input Validation
    ↓
Extract: owner, repo, pkg, branch?
```

### 2. Discovery Phase

```
Get Default Branch (if needed)
    ↓
Get Commit SHA for branch
    ↓
Fetch Git Tree (recursive)
    ↓
Filter: package.json files + lockfiles
```

### 3. Parsing Phase (Parallel)

```
For each package.json:              For each lockfile:
    ↓                                   ↓
Fetch via raw.githubusercontent      Fetch via raw.githubusercontent
    ↓                                   ↓
Parse JSON                           Stream parse (line-by-line)
    ↓                                   ↓
Extract dependency blocks            Search for package entries
    ↓                                   ↓
Find line numbers                    Extract resolved versions
    ↓                                   ↓
Create DependencySource              Create DependencySource
```

### 4. Aggregation Phase

```
Collect all DependencySource objects
    ↓
Validate semver patterns
    ↓
Deduplicate
    ↓
Generate line URLs
    ↓
Return ApiResponse
```

## Key Design Patterns

### 1. Streaming Parsing

- **Why**: Prevents memory exhaustion with large lockfiles
- **How**: ReadableStream → line-by-line processing → early termination
- **Memory bound**: ~5MB per request

### 2. Interface-Based Design

- **IGitHubClient**: Allows mocking in tests
- **Dependency Injection**: Components receive dependencies via constructor

### 3. Error Handling Strategy

```
GitHubApiError (custom)
    ↓
Maps to HTTP status codes
    ↓
400: Validation errors
404: Resource not found
502: Rate limit / GitHub unavailable
500: Unexpected errors
```

### 4. Validation Strategy

- **ArkType schemas**: Runtime validation
- **Regex patterns**: Owner, repo, package name validation
- **Semver validation**: Excludes workspace:, link:, file:, git+, http://

## Performance Characteristics

| Metric      | Target        | Strategy                                  |
| ----------- | ------------- | ----------------------------------------- |
| Memory      | < 5MB/request | Streaming parsers, no full file buffering |
| Latency     | < 1.5s        | Parallel file fetching, early termination |
| Throughput  | High          | Async I/O, minimal CPU work               |
| Scalability | Horizontal    | Stateless design, no shared state         |

## Testing Strategy

### Unit Tests

- VersionCollector semver validation
- ManifestParser JSON parsing
- Lockfile parser identification

### Integration Tests

- GitHubClient with MSW mocks
- RepoScanner with mocked client
- End-to-end request flow

### E2E Tests

- Full API requests with MSW
- Error scenarios (404, 502, validation)
- Branch parameter handling

## Observability

### Logging

- **Library**: pino (structured JSON logs)
- **Levels**: debug, info, warn, error
- **Context**: request params, file paths, version counts

### Tracing

- **Standard**: OpenTelemetry
- **Integration**: @elysiajs/opentelemetry
- **Exporters**: OTLP HTTP

### Metrics (Future)

- Request duration histogram
- GitHub API rate limit gauge
- Parse success/failure counters
