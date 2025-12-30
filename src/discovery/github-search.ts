import { Octokit } from '@octokit/rest';
import type {
  DiscoveredRepo,
  DesignSystemSignal,
  ActivitySignal,
  RepoScore,
} from '../types.js';
import {
  DESIGN_SYSTEM_WEIGHTS,
  ACTIVITY_WEIGHTS,
  MIN_SCORE_THRESHOLD,
} from '../types.js';

export interface GitHubSearchOptions {
  token: string;
  minStars?: number;
  maxResults?: number;
  languages?: string[];
}

export interface SearchQuery {
  term: string;
  signal: DesignSystemSignal;
}

// Search queries that indicate design system presence
const DESIGN_SYSTEM_QUERIES: SearchQuery[] = [
  { term: 'path:.storybook', signal: 'storybook' },
  { term: 'filename:tokens.json', signal: 'design-tokens' },
  { term: 'filename:design-tokens', signal: 'design-tokens' },
  { term: 'path:packages/ui OR path:packages/design-system', signal: 'ui-package' },
  { term: 'filename:.figmarc OR filename:figma.config', signal: 'figma-config' },
  { term: 'filename:variables.css OR filename:theme.css', signal: 'css-variables' },
];

export class GitHubSearcher {
  private octokit: Octokit;
  private options: Required<GitHubSearchOptions>;

  constructor(options: GitHubSearchOptions) {
    this.octokit = new Octokit({ auth: options.token });
    this.options = {
      token: options.token,
      minStars: options.minStars ?? 50,
      maxResults: options.maxResults ?? 100,
      languages: options.languages ?? ['TypeScript', 'JavaScript'],
    };
  }

  /**
   * Search for repos with design system indicators
   */
  async searchForDesignSystemRepos(): Promise<DiscoveredRepo[]> {
    const candidateUrls = new Set<string>();
    const repoMap = new Map<string, Partial<DiscoveredRepo>>();

    // Search for each design system signal
    for (const query of DESIGN_SYSTEM_QUERIES) {
      const repos = await this.searchWithQuery(query);
      for (const repo of repos) {
        if (!repo.url) continue;

        candidateUrls.add(repo.url);

        const existing = repoMap.get(repo.url) ?? {
          ...repo,
          designSystemSignals: [],
          activitySignals: [],
        };

        if (!existing.designSystemSignals?.includes(query.signal)) {
          existing.designSystemSignals = [
            ...(existing.designSystemSignals ?? []),
            query.signal,
          ];
        }

        repoMap.set(repo.url, existing);
      }
    }

    // Enrich repos with activity signals
    const enrichedRepos: DiscoveredRepo[] = [];

    for (const [url, partialRepo] of repoMap.entries()) {
      const activitySignals = await this.checkActivitySignals(
        partialRepo.owner!,
        partialRepo.name!
      );

      const designSystemSignals = partialRepo.designSystemSignals ?? [];
      const score = this.calculateScore(designSystemSignals, activitySignals);

      if (score.total >= MIN_SCORE_THRESHOLD) {
        enrichedRepos.push({
          url,
          owner: partialRepo.owner!,
          name: partialRepo.name!,
          description: partialRepo.description,
          stars: partialRepo.stars ?? 0,
          forks: partialRepo.forks ?? 0,
          defaultBranch: partialRepo.defaultBranch ?? 'main',
          lastCommit: partialRepo.lastCommit ?? new Date(),
          language: partialRepo.language,
          topics: partialRepo.topics ?? [],
          designSystemSignals,
          activitySignals,
          score,
          discoveredAt: new Date(),
        });
      }
    }

    // Sort by score descending
    enrichedRepos.sort((a, b) => b.score.total - a.score.total);

    return enrichedRepos.slice(0, this.options.maxResults);
  }

  /**
   * Search with a specific query
   */
  private async searchWithQuery(
    query: SearchQuery
  ): Promise<Array<Partial<DiscoveredRepo>>> {
    const repos: Array<Partial<DiscoveredRepo>> = [];

    try {
      const languageFilter = this.options.languages
        .map((l) => `language:${l}`)
        .join(' OR ');

      const searchQuery = `${query.term} stars:>=${this.options.minStars} (${languageFilter})`;

      const response = await this.octokit.search.repos({
        q: searchQuery,
        sort: 'stars',
        order: 'desc',
        per_page: 30,
      });

      for (const repo of response.data.items) {
        repos.push({
          url: repo.html_url,
          owner: repo.owner?.login ?? '',
          name: repo.name,
          description: repo.description ?? undefined,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          defaultBranch: repo.default_branch,
          lastCommit: new Date(repo.pushed_at ?? Date.now()),
          language: repo.language ?? undefined,
          topics: repo.topics ?? [],
        });
      }
    } catch (error) {
      console.error(`Search failed for query "${query.term}":`, error);
    }

    return repos;
  }

  /**
   * Check activity signals for a repo
   */
  private async checkActivitySignals(
    owner: string,
    repo: string
  ): Promise<ActivitySignal[]> {
    const signals: ActivitySignal[] = [];

    try {
      // Check for recent commits
      const commits = await this.octokit.repos.listCommits({
        owner,
        repo,
        per_page: 1,
      });

      if (commits.data.length > 0) {
        const lastCommit = commits.data[0];
        const commitDate = new Date(lastCommit?.commit?.author?.date ?? 0);
        const daysSinceCommit =
          (Date.now() - commitDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceCommit < 30) {
          signals.push('recent-commits');
        }
      }

      // Check for CONTRIBUTING.md
      try {
        await this.octokit.repos.getContent({
          owner,
          repo,
          path: 'CONTRIBUTING.md',
        });
        signals.push('contributing-guide');
      } catch {
        // File doesn't exist
      }

      // Check for good first issue labels
      const issues = await this.octokit.issues.listForRepo({
        owner,
        repo,
        labels: 'good first issue',
        state: 'open',
        per_page: 1,
      });

      if (issues.data.length > 0) {
        signals.push('good-first-issues');
      }

      // Check PR acceptance rate (sample recent closed PRs)
      const closedPRs = await this.octokit.pulls.list({
        owner,
        repo,
        state: 'closed',
        per_page: 20,
      });

      const mergedCount = closedPRs.data.filter((pr) => pr.merged_at).length;
      if (closedPRs.data.length > 0 && mergedCount / closedPRs.data.length > 0.5) {
        signals.push('high-pr-acceptance');
      }

      // Check star count
      const repoInfo = await this.octokit.repos.get({ owner, repo });
      if (repoInfo.data.stargazers_count > 100) {
        signals.push('high-stars');
      }
    } catch (error) {
      console.error(`Failed to check activity for ${owner}/${repo}:`, error);
    }

    return signals;
  }

  /**
   * Calculate repo score based on signals
   */
  private calculateScore(
    designSystemSignals: DesignSystemSignal[],
    activitySignals: ActivitySignal[]
  ): RepoScore {
    const breakdown: Record<string, number> = {};

    let designSystemScore = 0;
    for (const signal of designSystemSignals) {
      const weight = DESIGN_SYSTEM_WEIGHTS[signal];
      designSystemScore += weight;
      breakdown[signal] = weight;
    }

    let activityScore = 0;
    for (const signal of activitySignals) {
      const weight = ACTIVITY_WEIGHTS[signal];
      activityScore += weight;
      breakdown[signal] = weight;
    }

    return {
      total: designSystemScore + activityScore,
      designSystem: designSystemScore,
      activity: activityScore,
      breakdown,
    };
  }

  /**
   * Check if a specific repo has design system signals
   */
  async analyzeRepo(owner: string, repo: string): Promise<DiscoveredRepo | null> {
    try {
      const repoInfo = await this.octokit.repos.get({ owner, repo });

      // Check for design system signals by looking at file structure
      const designSystemSignals = await this.detectDesignSystemSignals(owner, repo);
      const activitySignals = await this.checkActivitySignals(owner, repo);

      const score = this.calculateScore(designSystemSignals, activitySignals);

      return {
        url: repoInfo.data.html_url,
        owner,
        name: repo,
        description: repoInfo.data.description ?? undefined,
        stars: repoInfo.data.stargazers_count,
        forks: repoInfo.data.forks_count,
        defaultBranch: repoInfo.data.default_branch,
        lastCommit: new Date(repoInfo.data.pushed_at ?? Date.now()),
        language: repoInfo.data.language ?? undefined,
        topics: repoInfo.data.topics ?? [],
        designSystemSignals,
        activitySignals,
        score,
        discoveredAt: new Date(),
      };
    } catch (error) {
      console.error(`Failed to analyze ${owner}/${repo}:`, error);
      return null;
    }
  }

  /**
   * Detect design system signals by checking file structure
   */
  private async detectDesignSystemSignals(
    owner: string,
    repo: string
  ): Promise<DesignSystemSignal[]> {
    const signals: DesignSystemSignal[] = [];

    const checks: Array<{ path: string; signal: DesignSystemSignal }> = [
      { path: '.storybook', signal: 'storybook' },
      { path: 'tokens.json', signal: 'design-tokens' },
      { path: 'design-tokens.json', signal: 'design-tokens' },
      { path: 'packages/ui', signal: 'ui-package' },
      { path: 'packages/design-system', signal: 'ui-package' },
    ];

    for (const check of checks) {
      try {
        await this.octokit.repos.getContent({
          owner,
          repo,
          path: check.path,
        });
        if (!signals.includes(check.signal)) {
          signals.push(check.signal);
        }
      } catch {
        // Path doesn't exist
      }
    }

    // Check for tailwind config with custom theme
    try {
      const tailwindConfig = await this.octokit.repos.getContent({
        owner,
        repo,
        path: 'tailwind.config.js',
      });

      if ('content' in tailwindConfig.data) {
        const content = Buffer.from(tailwindConfig.data.content, 'base64').toString();
        if (content.includes('theme') && content.includes('extend')) {
          signals.push('tailwind-theme');
        }
      }
    } catch {
      // No tailwind config
    }

    return signals;
  }
}
