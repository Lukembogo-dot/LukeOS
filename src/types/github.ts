// GitHub API Types

export interface GitHubCommit {
  date: string;
  message: string;
  repo: string;
}

export interface GitHubPullRequest {
  title: string;
  state: 'open' | 'closed' | 'merged';
  created_at: string;
  merged_at?: string;
  repo: string;
}

export interface GitHubActivity {
  commits: GitHubCommit[];
  pullRequests: GitHubPullRequest[];
  totalContributions: number;
}
