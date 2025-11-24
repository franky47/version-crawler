import { type } from 'arktype'
import { t } from 'elysia'

// ArkType morph to parse string header values to numbers
const parseIntMorph = type('string').pipe.try((s) => {
  const parsed = parseInt(s, 10)
  if (isNaN(parsed)) {
    throw new Error(`Cannot parse "${s}" as integer`)
  }
  return parsed
})

// ArkType schema for GitHub rate limit headers
// All fields are required as GitHub API always returns them
export const rateLimitHeaderSchema = type({
  limit: ['string|null', '=>', parseIntMorph],
  remaining: ['string|null', '=>', parseIntMorph],
  reset: ['string|null', '=>', parseIntMorph],
  used: ['string|null', '=>', parseIntMorph],
  resource: 'string|null',
})

export type RateLimitInfo = typeof rateLimitHeaderSchema.infer

// ArkType schemas for API validation
// GitHub username rules: alphanumeric + hyphens
export const ownerSchemaArkType = type('/^[a-zA-Z0-9-]+$/')

// GitHub repo name rules: alphanumeric + hyphens + periods + underscores
export const repoSchemaArkType = type('/^[a-zA-Z0-9-._]+$/')

// NPM package name rules (supports scoped packages)
// Length between 1 and 214 characters
export const packageSchemaArkType = type('string>=1').narrow(
  (s) => s.length <= 214
)

// Elysia validation schemas (for runtime validation in routes)
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

export const pathParamsSchema = t.Object({
  owner: ownerSchema,
  repo: repoSchema,
  pkg: packageSchema,
})
