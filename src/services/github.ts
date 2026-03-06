import axios from 'axios';
import { GitHubCommit, GitHubPullRequest, GitHubActivity } from '../types/github';

// =====================================================
// GITHUB API SERVICE
// =====================================================
// Fetches coding activity from GitHub

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
    'User-Agent': 'LukeOS-Brain/1.0',
  };
  
  if (token) {
    // Personal Access Tokens use 'token' prefix, not 'Bearer'
    headers['Authorization'] = `token ${token}`;
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
    
    // Filter events by date range - compare date strings to avoid timezone issues
    // Also include yesterday and tomorrow to handle timezone differences
    const startStr = startDate.split('T')[0];
    const endStr = endDate.split('T')[0];
    
    // Get dates 1 day before and after for timezone flexibility
    const startDateObj = new Date(startStr);
    startDateObj.setDate(startDateObj.getDate() - 1);
    const extendedStartStr = startDateObj.toISOString().split('T')[0];
    
    const endDateObj = new Date(endStr);
    endDateObj.setDate(endDateObj.getDate() + 1);
    const extendedEndStr = endDateObj.toISOString().split('T')[0];
    
    const filteredEvents = events.filter((event: any) => {
      const eventDateStr = event.created_at.split('T')[0];
      return eventDateStr >= extendedStartStr && eventDateStr <= extendedEndStr;
    });

    // Extract commits (PushEvent) - just use event data directly
    const commits: GitHubCommit[] = [];
    const pullRequests: GitHubPullRequest[] = [];

    for (const event of filteredEvents) {
      if (event.type === 'PushEvent') {
        // Use the event data directly - PushEvent has commit info
        // The commits array in the payload may not always be present, so handle both cases
        const commitMessages = event.payload.commits || [];
        if (commitMessages.length > 0) {
          for (const commit of commitMessages) {
            commits.push({
              date: event.created_at,
              message: commit.message,
              repo: event.repo.name,
            });
          }
        } else {
          // Fallback: just record the push event
          commits.push({
            date: event.created_at,
            message: `Push to ${event.repo.name}`,
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
