#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { GitHubSearcher, RegistryManager } from './discovery/index.js';
import { MIN_SCORE_THRESHOLD } from './types.js';

const program = new Command();

program
  .name('buoy-test')
  .description('Test harness for stress-testing Buoy against real-world design systems')
  .version('0.1.0');

// ============================================================================
// Discovery Commands
// ============================================================================

const discoverCmd = program.command('discover').description('Discover repos with design systems');

discoverCmd
  .command('search')
  .description('Search GitHub for repos with design system indicators')
  .option('--min-score <n>', 'Minimum score threshold', String(MIN_SCORE_THRESHOLD))
  .option('--min-stars <n>', 'Minimum star count', '50')
  .option('--max-results <n>', 'Maximum repos to find', '100')
  .action(async (options) => {
    const token = process.env['GITHUB_TOKEN'];
    if (!token) {
      console.error(chalk.red('Error: GITHUB_TOKEN environment variable required'));
      process.exit(1);
    }

    console.log(chalk.blue('Searching GitHub for repos with design systems...'));

    const searcher = new GitHubSearcher({
      token,
      minStars: parseInt(options.minStars, 10),
      maxResults: parseInt(options.maxResults, 10),
    });

    const repos = await searcher.searchForDesignSystemRepos();

    const minScore = parseInt(options.minScore, 10);
    const filtered = repos.filter((r) => r.score.total >= minScore);

    console.log(chalk.green(`\nFound ${filtered.length} repos (score >= ${minScore}):\n`));

    for (const repo of filtered.slice(0, 20)) {
      console.log(
        `  ${chalk.bold(repo.owner + '/' + repo.name)} ` +
          chalk.dim(`(score: ${repo.score.total}, stars: ${repo.stars})`)
      );
      console.log(
        `    Signals: ${[...repo.designSystemSignals, ...repo.activitySignals].join(', ')}`
      );
    }

    if (filtered.length > 20) {
      console.log(chalk.dim(`\n  ... and ${filtered.length - 20} more`));
    }

    // Save to registry
    const registryPath = process.cwd() + '/registry/repos.json';
    const registry = new RegistryManager(registryPath);
    const { added, updated } = await registry.addRepos(filtered);

    console.log(
      chalk.green(`\nRegistry updated: ${added} added, ${updated} updated`)
    );
  });

discoverCmd
  .command('add <repo>')
  .description('Analyze and add a specific repo (format: owner/name)')
  .action(async (repo) => {
    const token = process.env['GITHUB_TOKEN'];
    if (!token) {
      console.error(chalk.red('Error: GITHUB_TOKEN environment variable required'));
      process.exit(1);
    }

    const [owner, name] = repo.split('/');
    if (!owner || !name) {
      console.error(chalk.red('Error: Invalid repo format. Use owner/name'));
      process.exit(1);
    }

    console.log(chalk.blue(`Analyzing ${owner}/${name}...`));

    const searcher = new GitHubSearcher({ token });
    const discovered = await searcher.analyzeRepo(owner, name);

    if (!discovered) {
      console.error(chalk.red('Failed to analyze repo'));
      process.exit(1);
    }

    console.log(chalk.green(`\nRepo: ${discovered.owner}/${discovered.name}`));
    console.log(`  Score: ${discovered.score.total}`);
    console.log(`  Design System: ${discovered.designSystemSignals.join(', ') || 'none'}`);
    console.log(`  Activity: ${discovered.activitySignals.join(', ') || 'none'}`);
    console.log(`  Stars: ${discovered.stars}`);

    if (discovered.score.total < MIN_SCORE_THRESHOLD) {
      console.log(
        chalk.yellow(`\nScore below threshold (${MIN_SCORE_THRESHOLD}), not adding to registry`)
      );
      return;
    }

    const registryPath = process.cwd() + '/registry/repos.json';
    const registry = new RegistryManager(registryPath);
    await registry.addRepos([discovered]);

    console.log(chalk.green('\nAdded to registry'));
  });

// ============================================================================
// Registry Commands
// ============================================================================

const registryCmd = program.command('registry').description('Manage the repo registry');

registryCmd
  .command('list')
  .description('List repos in registry')
  .option('--top <n>', 'Show top N repos', '20')
  .option('--signal <signal>', 'Filter by signal')
  .action(async (options) => {
    const registryPath = process.cwd() + '/registry/repos.json';
    const registry = new RegistryManager(registryPath);

    let repos;
    if (options.signal) {
      repos = await registry.getReposWithSignal(options.signal);
    } else {
      repos = await registry.getTopRepos(parseInt(options.top, 10));
    }

    if (repos.length === 0) {
      console.log(chalk.yellow('No repos in registry. Run `buoy-test discover search` first.'));
      return;
    }

    console.log(chalk.bold(`\nRegistry (${repos.length} repos):\n`));

    for (const repo of repos) {
      const tested = repo.lastTestedAt
        ? chalk.green('tested')
        : chalk.dim('not tested');

      console.log(
        `  ${chalk.bold(repo.owner + '/' + repo.name)} ` +
          chalk.dim(`score:${repo.score.total}`) +
          ` [${tested}]`
      );
    }
  });

registryCmd
  .command('stats')
  .description('Show registry statistics')
  .action(async () => {
    const registryPath = process.cwd() + '/registry/repos.json';
    const registry = new RegistryManager(registryPath);
    const stats = await registry.getStats();

    console.log(chalk.bold('\nRegistry Statistics:\n'));
    console.log(`  Total repos: ${stats.totalRepos}`);
    console.log(`  Tested repos: ${stats.testedRepos}`);
    console.log(`  Average score: ${stats.avgScore.toFixed(1)}`);
    console.log('\n  Signal counts:');

    for (const [signal, count] of Object.entries(stats.signalCounts)) {
      console.log(`    ${signal}: ${count}`);
    }
  });

registryCmd
  .command('remove <repo>')
  .description('Remove a repo from registry (format: owner/name or URL)')
  .action(async (repo) => {
    const registryPath = process.cwd() + '/registry/repos.json';
    const registry = new RegistryManager(registryPath);

    // Handle both owner/name and URL formats
    const url = repo.includes('github.com')
      ? repo
      : `https://github.com/${repo}`;

    const removed = await registry.removeRepo(url);

    if (removed) {
      console.log(chalk.green(`Removed ${repo} from registry`));
    } else {
      console.log(chalk.yellow(`Repo not found in registry`));
    }
  });

// ============================================================================
// Run Commands (placeholder for now)
// ============================================================================

const runCmd = program.command('run').description('Run Buoy tests on repos');

runCmd
  .command('single <repo>')
  .description('Test a single repo')
  .action(async (repo) => {
    console.log(chalk.blue(`Testing ${repo}...`));
    console.log(chalk.yellow('Run command not yet implemented. Coming soon!'));
  });

runCmd
  .command('batch')
  .description('Test multiple repos from registry')
  .option('--top <n>', 'Test top N repos', '10')
  .option('--untested', 'Only test repos that havent been tested')
  .action(async (_options) => {
    console.log(chalk.blue('Batch testing...'));
    console.log(chalk.yellow('Batch command not yet implemented. Coming soon!'));
  });

// ============================================================================
// Assess Commands (placeholder for now)
// ============================================================================

program
  .command('assess <repo>')
  .description('Run full agent assessment on a tested repo')
  .action(async (repo) => {
    console.log(chalk.blue(`Assessing ${repo}...`));
    console.log(chalk.yellow('Assess command not yet implemented. Requires @buoy-design/agents.'));
  });

// ============================================================================
// Report Commands (placeholder for now)
// ============================================================================

program
  .command('aggregate')
  .description('Aggregate results across all tested repos')
  .action(async () => {
    console.log(chalk.blue('Aggregating results...'));
    console.log(chalk.yellow('Aggregate command not yet implemented. Coming soon!'));
  });

program.parse();
