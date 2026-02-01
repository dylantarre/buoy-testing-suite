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
  LIBRARY_TOPICS,
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

// Search queries that indicate design system presence (FRAMEWORKS - the libraries)
const DESIGN_SYSTEM_QUERIES: SearchQuery[] = [
  { term: 'path:.storybook', signal: 'storybook' },
  { term: 'filename:tokens.json', signal: 'design-tokens' },
  { term: 'filename:design-tokens', signal: 'design-tokens' },
  { term: 'path:packages/ui OR path:packages/design-system', signal: 'ui-package' },
  { term: 'filename:.figmarc OR filename:figma.config', signal: 'figma-config' },
  { term: 'filename:variables.css OR filename:theme.css', signal: 'css-variables' },
];

// Search queries for PRODUCTS - real apps using design systems
const PRODUCT_QUERIES: SearchQuery[] = [
  // Apps using popular component libraries
  { term: '"@chakra-ui/react" filename:package.json', signal: 'chakra-ui' },
  { term: '"@mantine/core" filename:package.json', signal: 'mantine' },
  { term: '"@radix-ui" filename:package.json', signal: 'radix-ui' },
  { term: '"@headlessui/react" filename:package.json', signal: 'headless-ui' },
  { term: '"class-variance-authority" filename:package.json', signal: 'cva' },
  // Apps with custom design systems
  { term: 'path:src/components path:src/theme', signal: 'custom-theme' },
  { term: 'path:app/components filename:theme.ts', signal: 'custom-theme' },
  // SaaS/Product indicators
  { term: 'path:src/components topic:saas', signal: 'saas-product' },
  { term: 'path:app/dashboard path:app/components', signal: 'dashboard-app' },
];

// Search queries specifically for APPS (not libraries) - these will have drift
const APP_QUERIES: SearchQuery[] = [
  // Next.js apps with Tailwind (high drift potential)
  { term: 'tailwindcss nextjs', signal: 'nextjs-app' },
  { term: 'tailwind next prisma', signal: 'nextjs-app' },
  { term: 'nextjs shadcn', signal: 'nextjs-app' },
  { term: 'next app router tailwind', signal: 'nextjs-app' },
  // Admin panels and dashboards (lots of custom styling)
  { term: 'admin dashboard tailwindcss', signal: 'admin-panel' },
  { term: 'dashboard tailwindcss react', signal: 'admin-panel' },
  { term: 'admin panel nextjs', signal: 'admin-panel' },
  { term: 'analytics dashboard', signal: 'admin-panel' },
  // E-commerce (complex UIs with drift)
  { term: 'ecommerce tailwindcss', signal: 'ecommerce' },
  { term: 'store tailwindcss nextjs', signal: 'ecommerce' },
  { term: 'stripe tailwindcss', signal: 'ecommerce' },
  { term: 'shopping cart react', signal: 'ecommerce' },
  { term: 'checkout nextjs', signal: 'ecommerce' },
  // SaaS apps
  { term: 'saas tailwindcss nextjs', signal: 'saas-product' },
  { term: 'tailwindcss prisma trpc', signal: 'saas-product' },
  { term: 'subscription app nextjs', signal: 'saas-product' },
  { term: 'multi-tenant nextjs', signal: 'saas-product' },
  // Blogs and portfolios
  { term: 'blog tailwindcss mdx', signal: 'blog-app' },
  { term: 'portfolio nextjs tailwind', signal: 'blog-app' },
  { term: 'personal website nextjs', signal: 'blog-app' },
  // General Tailwind apps
  { term: 'tailwindcss react typescript', signal: 'tailwind-app' },
  { term: 'tailwindcss webapp', signal: 'tailwind-app' },
  { term: 'fullstack nextjs', signal: 'tailwind-app' },
  { term: 'booking app tailwind', signal: 'tailwind-app' },
  { term: 'social app nextjs', signal: 'tailwind-app' },
  { term: 'chat app tailwindcss', signal: 'tailwind-app' },
  { term: 'crm nextjs', signal: 'tailwind-app' },
  { term: 'project management tailwind', signal: 'tailwind-app' },
];

// Helper to add delay between API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class GitHubSearcher {
  private octokit: Octokit;
  private options: Required<GitHubSearchOptions>;
  private lastApiCall: number = 0;
  private minDelayMs: number = 500; // Minimum 500ms between API calls

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
   * Throttle API calls to avoid rate limits
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastApiCall;
    if (elapsed < this.minDelayMs) {
      await delay(this.minDelayMs - elapsed);
    }
    this.lastApiCall = Date.now();
  }

  /**
   * Check rate limit and wait if needed
   */
  private async checkRateLimit(): Promise<void> {
    try {
      const { data } = await this.octokit.rateLimit.get();
      const remaining = data.resources.core.remaining;
      const resetTime = data.resources.core.reset * 1000;

      if (remaining < 50) {
        const waitMs = resetTime - Date.now() + 5000;
        if (waitMs > 0) {
          console.log(`Rate limit low (${remaining}). Waiting ${Math.ceil(waitMs / 1000)}s...`);
          await delay(waitMs);
        }
      }
    } catch {
      // Ignore rate limit check errors
    }
  }

  /**
   * Check if a repo is a design system library (not an app)
   */
  private isLibrary(repo: Partial<DiscoveredRepo>): boolean {
    const topics = repo.topics ?? [];
    const name = repo.name?.toLowerCase() ?? '';
    const desc = repo.description?.toLowerCase() ?? '';

    // Check topics for library indicators
    if (topics.some((t) => LIBRARY_TOPICS.includes(t.toLowerCase()))) {
      return true;
    }

    // Check for common UI library topics
    const uiLibraryTopics = ['components', 'ui', 'shadcn', 'radix', 'primitives'];
    const hasUiTopics = uiLibraryTopics.filter((t) =>
      topics.some((topic) => topic.toLowerCase() === t)
    ).length >= 2;
    if (hasUiTopics && !topics.includes('app') && !topics.includes('saas')) {
      return true;
    }

    // Check name for definitive library indicators
    const libraryNamePatterns = [
      'design-system', '-ds-', 'ds-',
      '-components', 'components-',
      '-library', 'library-',
      '-primitives', 'primitives-',
      '-kit', 'kit-',
      '/ui', // like "shadcn-ui/ui"
    ];
    if (libraryNamePatterns.some((p) => name.includes(p) || `${repo.owner}/${name}`.includes(p))) {
      return true;
    }

    // Exact name matches for known component libraries
    const exactLibraryNames = ['ui', 'components', 'primitives', 'core'];
    if (exactLibraryNames.includes(name)) {
      return true;
    }

    // Check description for library indicators
    const libraryDescPatterns = [
      'component library', 'design system', 'ui components',
      'ui kit', 'react components', 'vue components',
      'ui framework', 'collection of components',
      'beautifully designed', 'copy and paste',
      'accessible and customizable', 're-usable components',
    ];
    if (libraryDescPatterns.some((p) => desc.includes(p))) {
      return true;
    }

    // CLI tools and scaffolding
    if (name.startsWith('create-') || topics.includes('cli') || topics.includes('npx')) {
      return true;
    }

    // Also exclude boilerplates/templates/starters that aren't real apps
    const boilerplatePatterns = ['boilerplate', 'starter', 'template', 'scaffold', 'skeleton'];
    const isBoilerplateTopic = topics.some((t) =>
      boilerplatePatterns.some((p) => t.toLowerCase().includes(p))
    );
    const isBoilerplateName = boilerplatePatterns.some((p) => name.includes(p));
    const isBoilerplateDesc = boilerplatePatterns.some((p) => desc.includes(p));

    // Exclude if multiple signals suggest it's a template
    if ((isBoilerplateTopic && isBoilerplateName) || (isBoilerplateTopic && isBoilerplateDesc)) {
      return true;
    }

    return false;
  }

  /**
   * Search for apps (not libraries) that are likely to have design drift
   */
  async searchForApps(
    options: { concurrency?: number; page?: number; onProgress?: (completed: number, total: number, phase: string) => void } = {}
  ): Promise<DiscoveredRepo[]> {
    const concurrency = options.concurrency ?? 2; // Lower concurrency to avoid rate limits
    const page = options.page ?? 1;
    const repoMap = new Map<string, Partial<DiscoveredRepo>>();

    // Check rate limit before starting
    await this.checkRateLimit();

    // Only use app-focused queries
    const allQueries = APP_QUERIES;

    // Phase 1: Run search queries in parallel batches
    const searchResults: Array<{ query: SearchQuery; repos: Array<Partial<DiscoveredRepo>> }> = [];

    for (let i = 0; i < allQueries.length; i += concurrency) {
      const batch = allQueries.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async (query) => ({
          query,
          repos: await this.searchWithQuery(query, page),
        }))
      );
      searchResults.push(...batchResults);

      if (options.onProgress) {
        options.onProgress(Math.min(i + concurrency, allQueries.length), allQueries.length, 'search');
      }
    }

    // Merge results, filtering out libraries
    for (const { query, repos } of searchResults) {
      for (const repo of repos) {
        if (!repo.url) continue;

        // Skip if it looks like a library
        if (this.isLibrary(repo)) continue;

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

    // Phase 2: Enrich repos with activity signals in parallel
    const repoEntries = Array.from(repoMap.entries());
    const enrichedRepos: DiscoveredRepo[] = [];

    for (let i = 0; i < repoEntries.length; i += concurrency) {
      const batch = repoEntries.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async ([url, partialRepo]) => {
          // Double-check it's not a library by looking at file structure
          const isLib = await this.checkIsLibrary(partialRepo.owner!, partialRepo.name!);
          if (isLib) return null;

          const activitySignals = await this.checkActivitySignals(
            partialRepo.owner!,
            partialRepo.name!
          );
          return { url, partialRepo, activitySignals };
        })
      );

      for (const result of batchResults) {
        if (!result) continue;

        const { url, partialRepo, activitySignals } = result;
        const designSystemSignals = partialRepo.designSystemSignals ?? [];
        const score = this.calculateScore(designSystemSignals, activitySignals);

        // Lower threshold for apps - we want more variety
        if (score.total >= 3) {
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

      if (options.onProgress) {
        options.onProgress(Math.min(i + concurrency, repoEntries.length), repoEntries.length, 'enrich');
      }
    }

    // Sort by score descending
    enrichedRepos.sort((a, b) => b.score.total - a.score.total);

    return enrichedRepos.slice(0, this.options.maxResults);
  }

  /**
   * Check if repo has library-like file structure
   * Simplified to just check for packages/ directory to conserve API calls
   */
  private async checkIsLibrary(owner: string, repo: string): Promise<boolean> {
    try {
      // Only check for packages/ directory (monorepo/library indicator)
      // This is the strongest signal and saves API calls
      await this.throttle();
      await this.octokit.repos.getContent({ owner, repo, path: 'packages' });
      return true;
    } catch {
      // No packages dir = probably not a library
      return false;
    }
  }

  /**
   * Search for repos with design system indicators
   */
  async searchForDesignSystemRepos(
    options: { concurrency?: number; onProgress?: (completed: number, total: number, phase: string) => void } = {}
  ): Promise<DiscoveredRepo[]> {
    const concurrency = options.concurrency ?? 5;
    const repoMap = new Map<string, Partial<DiscoveredRepo>>();

    // Combine framework and product queries
    const allQueries = [...DESIGN_SYSTEM_QUERIES, ...PRODUCT_QUERIES];

    // Phase 1: Run search queries in parallel batches
    const searchResults: Array<{ query: SearchQuery; repos: Array<Partial<DiscoveredRepo>> }> = [];

    for (let i = 0; i < allQueries.length; i += concurrency) {
      const batch = allQueries.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async (query) => ({
          query,
          repos: await this.searchWithQuery(query),
        }))
      );
      searchResults.push(...batchResults);

      if (options.onProgress) {
        options.onProgress(Math.min(i + concurrency, allQueries.length), allQueries.length, 'search');
      }
    }

    // Merge results from all queries
    for (const { query, repos } of searchResults) {
      for (const repo of repos) {
        if (!repo.url) continue;

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

    // Phase 2: Enrich repos with activity signals in parallel
    const repoEntries = Array.from(repoMap.entries());
    const enrichedRepos: DiscoveredRepo[] = [];

    for (let i = 0; i < repoEntries.length; i += concurrency) {
      const batch = repoEntries.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async ([url, partialRepo]) => {
          const activitySignals = await this.checkActivitySignals(
            partialRepo.owner!,
            partialRepo.name!
          );
          return { url, partialRepo, activitySignals };
        })
      );

      for (const { url, partialRepo, activitySignals } of batchResults) {
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

      if (options.onProgress) {
        options.onProgress(Math.min(i + concurrency, repoEntries.length), repoEntries.length, 'enrich');
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
    query: SearchQuery,
    page: number = 1
  ): Promise<Array<Partial<DiscoveredRepo>>> {
    const repos: Array<Partial<DiscoveredRepo>> = [];

    try {
      // Run a search for each language (OR doesn't work well in GitHub search)
      for (const language of this.options.languages) {
        await this.throttle(); // Rate limit protection

        const searchQuery = `${query.term} stars:>=${this.options.minStars} language:${language}`;

        // Alternate sort methods to get different results
        const sortOptions: Array<{ sort: 'stars' | 'updated'; order: 'desc' | 'asc' }> = [
          { sort: 'stars', order: 'desc' },
          { sort: 'updated', order: 'desc' },
        ];
        const sortOption = sortOptions[page % sortOptions.length] ?? sortOptions[0];

        const response = await this.octokit.search.repos({
          q: searchQuery,
          sort: sortOption!.sort,
          order: sortOption!.order,
          per_page: 30,
          page: page,
        });

        for (const repo of response.data.items) {
          // Skip if already added
          if (repos.some((r) => r.url === repo.html_url)) continue;

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
      await this.throttle();
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
        await this.throttle();
        await this.octokit.repos.getContent({
          owner,
          repo,
          path: 'CONTRIBUTING.md',
        });
        signals.push('contributing-guide');
      } catch {
        // File doesn't exist
      }

      // Skip expensive checks (PRs, issues) to conserve rate limit
      // Just check star count from the repo info we already have cached
      await this.throttle();
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

    // Check package.json for product signals (design system library usage)
    try {
      const pkgContent = await this.octokit.repos.getContent({
        owner,
        repo,
        path: 'package.json',
      });

      if ('content' in pkgContent.data) {
        const pkg = Buffer.from(pkgContent.data.content, 'base64').toString();

        if (pkg.includes('@chakra-ui/react')) signals.push('chakra-ui');
        if (pkg.includes('@mantine/core')) signals.push('mantine');
        if (pkg.includes('@radix-ui')) signals.push('radix-ui');
        if (pkg.includes('@headlessui/react')) signals.push('headless-ui');
        if (pkg.includes('class-variance-authority')) signals.push('cva');
      }
    } catch {
      // No package.json or can't read it
    }

    return signals;
  }
}
