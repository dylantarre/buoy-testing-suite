import { z } from 'zod';

// ============================================================================
// Repository Discovery & Scoring
// ============================================================================

export const DesignSystemSignalSchema = z.enum([
  'storybook',
  'design-tokens',
  'figma-config',
  'ui-package',
  'css-variables',
  'tailwind-theme',
]);

export type DesignSystemSignal = z.infer<typeof DesignSystemSignalSchema>;

export const ActivitySignalSchema = z.enum([
  'recent-commits',
  'contributing-guide',
  'good-first-issues',
  'high-pr-acceptance',
  'high-stars',
]);

export type ActivitySignal = z.infer<typeof ActivitySignalSchema>;

export const RepoScoreSchema = z.object({
  total: z.number(),
  designSystem: z.number(),
  activity: z.number(),
  breakdown: z.record(z.string(), z.number()),
});

export type RepoScore = z.infer<typeof RepoScoreSchema>;

export const DiscoveredRepoSchema = z.object({
  url: z.string(),
  owner: z.string(),
  name: z.string(),
  description: z.string().optional(),
  stars: z.number(),
  forks: z.number(),
  defaultBranch: z.string(),
  lastCommit: z.date(),
  language: z.string().optional(),
  topics: z.array(z.string()),

  // Detected signals
  designSystemSignals: z.array(DesignSystemSignalSchema),
  activitySignals: z.array(ActivitySignalSchema),

  // Scoring
  score: RepoScoreSchema,

  // Metadata
  discoveredAt: z.date(),
  lastTestedAt: z.date().optional(),
});

export type DiscoveredRepo = z.infer<typeof DiscoveredRepoSchema>;

// ============================================================================
// Registry
// ============================================================================

export const RegistrySchema = z.object({
  version: z.string(),
  lastUpdated: z.date(),
  repos: z.array(DiscoveredRepoSchema),
});

export type Registry = z.infer<typeof RegistrySchema>;

// ============================================================================
// Test Execution
// ============================================================================

export const TestStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'timeout',
  'skipped',
]);

export type TestStatus = z.infer<typeof TestStatusSchema>;

export const BuoyOutputSchema = z.object({
  scan: z.object({
    components: z.number(),
    tokens: z.number(),
    sources: z.array(z.string()),
  }).optional(),
  status: z.object({
    coverage: z.record(z.string(), z.number()),
  }).optional(),
  drift: z.object({
    total: z.number(),
    byType: z.record(z.string(), z.number()),
    bySeverity: z.record(z.string(), z.number()),
    signals: z.array(z.unknown()),
  }).optional(),
});

export type BuoyOutput = z.infer<typeof BuoyOutputSchema>;

export const TestRunSchema = z.object({
  id: z.string(),
  repo: DiscoveredRepoSchema,
  status: TestStatusSchema,
  startedAt: z.date(),
  completedAt: z.date().optional(),
  durationMs: z.number().optional(),

  // Buoy outputs
  buoyOutput: BuoyOutputSchema.optional(),

  // Errors if any
  error: z.string().optional(),

  // Config used
  buoyVersion: z.string(),
  configGenerated: z.boolean(),
});

export type TestRun = z.infer<typeof TestRunSchema>;

// ============================================================================
// Reports
// ============================================================================

export const AccuracyAnnotationSchema = z.object({
  signalId: z.string(),
  expectedResult: z.enum(['true-positive', 'false-positive', 'true-negative', 'false-negative']),
  notes: z.string().optional(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.date().optional(),
});

export type AccuracyAnnotation = z.infer<typeof AccuracyAnnotationSchema>;

export const TestReportSchema = z.object({
  repo: z.object({
    url: z.string(),
    name: z.string(),
    owner: z.string(),
  }),
  score: z.number(),
  testedAt: z.date(),
  buoyVersion: z.string(),

  // Design system sources detected
  designSystemSources: z.array(z.string()),

  // Scan results
  scan: z.object({
    components: z.number(),
    tokens: z.number(),
    coverage: z.record(z.string(), z.number()),
  }),

  // Drift results
  drift: z.object({
    total: z.number(),
    byType: z.record(z.string(), z.number()),
    bySeverity: z.record(z.string(), z.number()),
  }),

  // Accuracy tracking (filled in during review)
  accuracy: z.object({
    annotations: z.array(AccuracyAnnotationSchema),
    truePositives: z.number(),
    falsePositives: z.number(),
    precision: z.number().optional(),
  }).optional(),
});

export type TestReport = z.infer<typeof TestReportSchema>;

// ============================================================================
// Aggregate Statistics
// ============================================================================

export const AggregateStatsSchema = z.object({
  totalRepos: z.number(),
  testedRepos: z.number(),
  totalDriftSignals: z.number(),
  totalComponents: z.number(),
  totalTokens: z.number(),

  // By drift type
  driftByType: z.record(z.string(), z.number()),

  // By severity
  driftBySeverity: z.record(z.string(), z.number()),

  // Coverage
  avgComponentCoverage: z.number(),
  avgTokenCoverage: z.number(),

  // Accuracy (if annotations exist)
  overallPrecision: z.number().optional(),

  // Top issues
  topDriftTypes: z.array(z.object({
    type: z.string(),
    count: z.number(),
    percentage: z.number(),
  })),

  generatedAt: z.date(),
});

export type AggregateStats = z.infer<typeof AggregateStatsSchema>;

// ============================================================================
// Signal Weights (for scoring)
// ============================================================================

export const DESIGN_SYSTEM_WEIGHTS: Record<DesignSystemSignal, number> = {
  'storybook': 3,
  'design-tokens': 3,
  'ui-package': 3,
  'figma-config': 2,
  'css-variables': 2,
  'tailwind-theme': 2,
};

export const ACTIVITY_WEIGHTS: Record<ActivitySignal, number> = {
  'recent-commits': 2,
  'contributing-guide': 2,
  'high-pr-acceptance': 2,
  'good-first-issues': 1,
  'high-stars': 1,
};

export const MIN_SCORE_THRESHOLD = 5;
