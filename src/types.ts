export type DependencyType =
  | 'dependencies'
  | 'devDependencies'
  | 'peerDependencies'
  | 'optionalDependencies'
  | 'resolved'

export type DependencySource = {
  path: string
  type: 'manifest' | 'lockfile'
  dependencyType: DependencyType
  version: string
  lineUrl: string
}

export type ApiResponse = {
  repo: string
  pkg: string
  sources: DependencySource[]
}

export type GitHubTreeItem = {
  path: string
  mode: string
  type: 'blob' | 'tree'
  sha: string
  size?: number
  url: string
}

export type GitHubTree = {
  sha: string
  url: string
  tree: GitHubTreeItem[]
  truncated: boolean
}

export type GitHubCommit = {
  sha: string
  node_id: string
  commit: {
    author: {
      name: string
      email: string
      date: string
    }
    committer: {
      name: string
      email: string
      date: string
    }
    message: string
  }
}

export type GitHubRepo = {
  name: string
  full_name: string
  default_branch: string
  owner: {
    login: string
  }
}

export interface IGitHubClient {
  getCommitSha(owner: string, repo: string, ref: string): Promise<string>
  getDefaultBranch(owner: string, repo: string): Promise<string>
  getTree(owner: string, repo: string, sha: string): Promise<GitHubTree>
  getRawFileContent(
    owner: string,
    repo: string,
    sha: string,
    path: string
  ): Promise<Response>
}
