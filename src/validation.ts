import { t } from 'elysia'

// GitHub username rules: alphanumeric + hyphens
const ownerSchema = t.String({
  pattern: '^[a-zA-Z0-9-]+$',
  error:
    'Invalid owner name. Must contain only alphanumeric characters and hyphens.',
})

// GitHub repo name rules: alphanumeric + hyphens + periods + underscores
const repoSchema = t.String({
  pattern: '^[a-zA-Z0-9-._]+$',
  error:
    'Invalid repository name. Must contain only alphanumeric characters, hyphens, periods, and underscores.',
})

// NPM package name rules (supports scoped packages)
// Simplified: allows alphanumeric, hyphens, underscores, dots, and scoped packages
const packageSchema = t.String({
  minLength: 1,
  maxLength: 214,
  error: 'Invalid package name.',
})

// Optional branch/tag parameter
const branchSchema = t.Optional(
  t.String({
    minLength: 1,
    error: 'Branch name cannot be empty.',
  })
)

export const pathParamsSchema = t.Object({
  owner: ownerSchema,
  repo: repoSchema,
  pkg: packageSchema,
})

export const queryParamsSchema = t.Object({
  branch: branchSchema,
})
