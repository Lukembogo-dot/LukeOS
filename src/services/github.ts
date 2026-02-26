import axios from 'axios';

// =====================================================
// GITHUB API SERVICE
// =====================================================
// Fetches coding activity from GitHub

interface GitHubCommit {
  date: string;
  message: string;
  repo: string;
}

interface GitHubPullRequest {
  title: string;
  state: 'open' | 'closed' | 'merged';
  created_at: string;
  merged_at?: string;
  repo: string;
}

interface GitHubActivity {
  commits: GitHubCommit[];
  pullRequests: GitHubPullRequest[];
  totalContributions: number;
}

/**
 * Get user's GitHub activity for a date range
 */
export async function getGitHubActivity(
  username: string,
  startDate: string,
  endDate: string,
  token?: string
): Promise<GitHubActivity> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    // Get user's contributions calendar (last year)
    const [userRes, eventsRes] = await Promise.all([
      axios.get(`https://api.github.com/users/${username}`, { headers }),
      axios.get(`https://api.github.com/users/${username}/events`, { 
        headers,
        params: { per_page: 100 }
      })
    ]);

    const events = eventsRes.data || [];
    
    // Filter events by date range
    const filteredEvents = events.filter((event: any) => {
      const eventDate = new Date(event.created_at);
      return eventDate >= new Date(startDate) && eventDate <= new Date(endDate);
    });

    // Extract commits (PushEvent)
    const commits: GitHubCommit[] = [];
    const pullRequests: GitHubPullRequest[] = [];

    for (const event of filteredEvents) {
      if (event.type === 'PushEvent') {
        for (const commit of (event.payload.commits || []).slice(0, 5)) {
          commits.push({
            date: event.created_at,
            message: commit.message,
            repo: event.repo.name,
          });
        }
      } else if (event.type === 'PullRequestEvent') {
        pullRequests.push({
          title: event.payload.pull_request.title,
          state: event.payload.pull_request.merged ? 'merged' : event.payload.pull_request.state,
          created_at: event.payload.pull_request.created_at,
          merged_at: event.payload.pull_request.merged_at,
          repo: event.repo.name,
        });
      }
    }

    return {
      commits,
      pullRequests,
      totalContributions: commits.length + pullRequests.length,
    };
  } catch (error: any) {
    console.error('GitHub API error:', error.response?.data || error.message);
    return {
      commits: [],
      pullRequests: [],
      totalContributions: 0,
    };
  }
}

/**
 * Get commit stats summary
 */
export function summarizeGitHubActivity(activity: GitHubActivity): {
  codingMinutes: number;
  prsOpened: number;
  prsMerged: number;
  reposWorked: number;
} {
  // Estimate: avg 30 min per commit
  const codingMinutes = activity.commits.length * 30;
  const prsOpened = activity.pullRequests.filter(pr => pr.state === 'open').length;
  const prsMerged = activity.pullRequests.filter(pr => pr.state === 'merged').length;
  
  const repos = new Set([
    ...activity.commits.map(c => c.repo),
    ...activity.pullRequests.map(pr => pr.repo)
  ]);

  return {
    codingMinutes,
    prsOpened,
    prsMerged,
    reposWorked: repos.size,
  };
}
