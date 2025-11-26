import { type } from 'arktype'

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
export const ownerSchema =
  type('/^[a-zA-Z0-9-_]+$/').describe('GitHub owner name')

// GitHub repo name rules: alphanumeric + hyphens + periods + underscores
export const repoSchema = type('/^[a-zA-Z0-9-._]+$/').describe(
  'GitHub repository name'
)

// NPM package name rules (supports scoped packages)
// Length between 1 and 214 characters
export const packageSchema = type('/^(@[a-zA-Z0-9-]+\\/)?[a-zA-Z0-9-]+$/')
  .narrow((value) => value.length <= 214)
  .describe('NPM package name')

export const pathParamsSchema = type({
  owner: ownerSchema,
  repo: repoSchema,
  '*': packageSchema,
})
