# **PRD: Repository Dependency Version Discovery API**

## **1. Overview**

This service provides an HTTP API for discovering all **declared dependency version ranges** for a given package within a GitHub repository, without cloning the repository locally.
Given `/foo/bar/baz` (where `foo` is owner, `bar` is repo, `baz` is package), the API returns a list of sources containing semver strings that appear in the lockfiles or `package.json` files of `foo/bar`. If the package does not appear in the repo, the sources list is empty.

The service uses **Bun**, **TypeScript**, and **Elysia**.
The GitHub API is accessed in a **streaming, memory-bounded way**.

---

## **2. Goals**

- Identify all declared version ranges of a specific npm package in a GitHub repository.
- Avoid cloning the repository.
- Support very large lockfiles and monorepos.
- Ensure extremely low memory overhead by using streaming parsers.
- Provide consistent, fast responses.
- Support public repositories only.
- Provide a simple REST interface.

---

## **3. Non-Goals**

- Full dependency graph construction.
- Support for private GitHub repositories.
- Support for non-npm ecosystems (e.g., cargo, pip).
- Git submodules.
- Range resolution to concrete versions.

---

## **4. Inputs & API Behavior**

### **4.1 Endpoint**

```
GET /:owner/:repo/:pkg?branch=<branch>
```

### **4.2 Path Parameters**

| Name    | Description                      | Validation                                                                |
| ------- | -------------------------------- | ------------------------------------------------------------------------- |
| `owner` | GitHub user or organization name | Alphanumeric + hyphens (GitHub username rules)                            |
| `repo`  | GitHub repository name           | Alphanumeric + hyphens + periods + underscores                            |
| `pkg`   | npm package name to search for   | Valid npm package name (scoped packages must be URL encoded if necessary) |

### **4.3 Query Parameters**

| Name     | Description                      | Required                      |
| -------- | -------------------------------- | ----------------------------- |
| `branch` | Specific branch or tag to search | no (defaults to repo default) |

### **4.4 Response**

`200 OK`
`Content-Type: application/json`

Payload:

```json
{
  "repo": "foo/bar",
  "pkg": "baz",
  "sources": [
    {
      "path": "package.json",
      "type": "manifest",
      "dependencyType": "dependencies",
      "version": "^1.0.0",
      "lineUrl": "https://github.com/foo/bar/blob/main/package.json#L15"
    },
    {
      "path": "packages/app1/package.json",
      "type": "manifest",
      "dependencyType": "devDependencies",
      "version": "~2.5.3",
      "lineUrl": "https://github.com/foo/bar/blob/main/packages/app1/package.json#L22"
    },
    {
      "path": "pnpm-lock.yaml",
      "type": "lockfile",
      "dependencyType": "resolved",
      "version": "3.0.0",
      "lineUrl": "https://github.com/foo/bar/blob/main/pnpm-lock.yaml#L450"
    }
  ]
}
```

Sources array may be empty.

---

## **5. High-Level Flow**

### **5.1 Step 1 — Validate Input**

- `owner` must match regex: `^[a-zA-Z0-9-]+$` (standard GitHub username rules).
- `repo` must match regex: `^[a-zA-Z0-9-._]+$` (standard GitHub repo name rules).
- `pkg` must be a valid npm package name (e.g., `react`, `@types/node`).

If invalid → 400.

---

### **5.2 Step 2 — Determine Entry Commit**

1. **If `branch` is provided:**
   - Fetch commit SHA for that ref:
     ```
     GET /repos/:owner/:repo/commits/:branch
     ```
2. **If `branch` is omitted:**
   - Fetch repository metadata:
     ```
     GET /repos/:owner/:repo
     ```
   - Extract `default_branch` and its latest commit SHA.

---

### **5.3 Step 3 — Discover Files of Interest**

#### **3.1 Fetch Git Tree (recursive)**

```
GET /repos/:owner/:repo/git/trees/:sha?recursive=1
```

Scan the resulting paths for:

- `package.json`
- `package-lock.json`
- `yarn.lock`
- `pnpm-lock.yaml`
- optionally `.yarn/…` indicators for Berry

We do **not** download these files yet.

---

### **5.4 Step 4 — Extract Declared Ranges from package.json files**

For each path ending in `package.json`:

1. Fetch via GitHub raw:

   ```
   GET https://raw.githubusercontent.com/<repo>/<sha>/<path>
   ```

2. Parse JSON content while tracking line numbers (or perform text search for the package key within dependency blocks).
3. Extract ranges from:

   - dependencies
   - devDependencies
   - peerDependencies
   - optionalDependencies

If `pkg` appears, record the semver range and the line number to construct the GitHub blob URL.

---

### **5.5 Step 5 — Stream Parse Lockfiles for Resolved Versions (Optional)**

To support monorepos where lockfiles may encode ranges indirectly, we stream parse:

- Yarn v1 (`yarn.lock`)
- Yarn v2+ (`yarn.lock`)
- PNPM (`pnpm-lock.yaml`)
- npm (`package-lock.json`)

Parsing is done using the **streaming parsers** described in previous steps, with **ArkType** validation and **early termination** when `pkg` is found.

Each parser produces:

- version string
- line number of occurrence
- possibly range → if recoverable (e.g., Yarn v1 header)
- or null if not recoverable (npm/pnpm lockfiles have only resolved versions)

Only semver strings matching the package name are collected.

---

## **6. Semver Value Normalization**

Before inserting into the final set:

- Remove surrounding quotes
- Keep raw semver/range exactly as authored
- Sort in stable alphanumeric order
- Deduplicate

Examples accepted:

- `^1.2.3`
- `~4.0`
- `5.0.1`
- `workspace:*`
- `link:../local` (ignored, not a semver — spec: exclude non-semver ranges)

Only valid semver or semver ranges are returned.

---

## **7. Output Schema**

```ts
type DependencyType =
  | 'dependencies'
  | 'devDependencies'
  | 'peerDependencies'
  | 'optionalDependencies'
  | 'resolved'

type ApiResponse = {
  repo: string
  pkg: string
  sources: {
    path: string
    type: 'manifest' | 'lockfile'
    dependencyType: DependencyType
    version: string
    lineUrl: string
  }[]
}
```

---

## **8. Errors**

### **400 Bad Request**

- Missing `repo` or `pkg`
- Invalid repo format
- Invalid package name

### **404 Not Found**

- GitHub reports the repository does not exist

### **502 Bad Gateway**

- GitHub API rate limit exceeded

### **500 Internal Server Error**

- Any unexpected error

---

## **9. Architecture**

### **9.1 The Server**

- **Bun** runtime
- **Elysia** server
- Routes defined in TypeScript

### **9.2 Components**

#### **GitHubClient**

- Wraps GitHub HTTP requests
- Authenticates using `GITHUB_TOKEN` (Bearer)
- Handles rate-limit headers
- Returns Response or throws helpful errors

#### **RepoScanner**

- Fetches git tree recursively
- Identifies relevant files
- Fetches manifest JSON

#### **LockfileStreamers**

Stream-reading parsers implementing early exit:

- `findInNpmLock(fileUrl, pkg)`
- `findInYarnV1Lock(fileUrl, pkg)`
- `findInYarnBerryLock(fileUrl, pkg)`
- `findInPnpmLock(fileUrl, pkg)`

Each:

- initiates a `fetch()` request and pipes the response body stream directly into the parser.
- decodes chunks as UTF-8 incrementally without buffering the entire file.
- validates blocks using ArkType.
- yields zero or more semver values.
- cancels the stream (aborts the request) once all content relevant to `pkg` is processed to minimize data transfer and memory usage.

#### **VersionCollector**

- Maintains a deduped set
- Performs semver/range validation using regex
- Normalizes values

---

## **10. Performance Requirements**

- Memory usage should remain under **5MB** per request.
- No entire lockfile should be loaded into memory.
- Response time should be **< 1.5s** for typical repositories.
- Must allow concurrent requests without blocking.

---

## **11. Rate Limit Handling**

- GitHub REST API → respect `X-RateLimit-Remaining`
- When `0`, return 502 with structured error
- Apply a small retry (max 1) for secondary requests

---

## **12. Observability**

- Structured logs (JSON)
- Duration logging per stage:

  - metadata fetch
  - tree fetch
  - manifest scan
  - lockfile streaming
  - response assembly

- Errors logged with stack trace

---

## **13. Summary**

This PRD describes a Bun+Elysia API service exposing a single endpoint for discovering all semver ranges of a package within a GitHub repository. It uses efficient streaming parsing, low memory usage, ArkType validation, and GitHub’s native API to avoid cloning while handling large monorepos.

---

## **14. Testing Strategy**

To ensure reliability and maintainability, the architecture must support isolated testing of each component. All tests should be scaffolded and executed using **Bun's native test runner** (`bun:test`).

### **14.1 Unit Tests**

- **Validators**: Test input validation logic (regex for repo/owner, package name validation) with various valid and invalid inputs.
- **Parsers**: Test `LockfileStreamers` and `ManifestParsers` against sample file contents (strings/streams) without network calls. Verify they correctly extract versions and line numbers.
- **VersionCollector**: Test normalization and deduplication logic.

### **14.2 Integration Tests**

- **GitHubClient**: Use **MSW (Mock Service Worker)** to intercept and mock GitHub API requests. Verify that the client handles rate limits, 404s, and successful responses correctly without hitting the real API.
- **RepoScanner**: Mock the `GitHubClient` to test tree traversal and file identification logic without hitting the real GitHub API.

### **14.3 End-to-End (E2E) Tests**

- Spin up the Elysia server.
- Use **MSW** to simulate GitHub responses for various scenarios (valid repo, missing package, rate limited, etc.).
- Verify the full request-response cycle for the `/owner/repo/pkg` endpoint.

### **14.4 Decoupling for Testability**

- **Interfaces**: Define interfaces for `GitHubClient` and `Parser` components.
- **Dependency Injection**: Inject these dependencies into the service/controller layer. This allows swapping real implementations with mocks during tests.

---

## **15. Configuration**

| Variable       | Description                                                  | Required |
| -------------- | ------------------------------------------------------------ | -------- |
| `GITHUB_TOKEN` | GitHub Personal Access Token used for API requests (Bearer). | Yes      |
