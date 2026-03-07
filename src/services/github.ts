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
    // Get user's events
    const eventsRes = await axios.get(`https://api.github.com/users/${username}/events`, { 
      headers,
      params: { per_page: 100 }
    });

    const events = eventsRes.data || [];
    
    // Filter events by date range
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
    
    console.log(`📊 Found ${events.length} total events, ${filteredEvents.length} in range ${extendedStartStr}-${extendedEndStr}`);
    console.log(`🔍 PushEvents: ${filteredEvents.filter((e: any) => e.type === 'PushEvent').length}`);

    // Extract commits (PushEvent) - need to fetch commit details from commits API
    const commits: GitHubCommit[] = [];
    const pullRequests: GitHubPullRequest[] = [];
    
    // Get unique repos from push events
    const pushEvents = filteredEvents.filter((e: any) => e.type === 'PushEvent');
    
    // Fetch commit details for each repo
    for (const event of pushEvents) {
      const repoName = event.repo.name;
      const headSha = event.payload.head;
      
      if (headSha) {
        try {
          // Fetch the commit details from the commits API
          const commitRes = await axios.get(
            `https://api.github.com/repos/${repoName}/commits/${headSha}`, 
            { headers }
          );
          
          const commitData = commitRes.data;
          commits.push({
            date: event.created_at,
            message: commitData.commit?.message || `Push to ${repoName}`,
            repo: repoName,
          });
        } catch (commitErr) {
          // Fallback if we can't fetch commit details
          commits.push({
            date: event.created_at,
            message: `Push to ${repoName} (SHA: ${headSha})`,
            repo: repoName,
          });
        }
      } else {
        commits.push({
          date: event.created_at,
          message: `Push to ${repoName}`,
          repo: repoName,
        });
      }
      
      // Rate limiting - be nice to GitHub API
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Process PullRequestEvents
    for (const event of filteredEvents) {
      if (event.type === 'PullRequestEvent' && event.payload.pull_request) {
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
