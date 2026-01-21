# Buoy Testing Suite

Test harness for stress-testing [Buoy](https://github.com/ahoybuoy) against real-world open source projects with design systems.

## Goals

1. **Accuracy benchmarking** - Measure false positive/negative rates
2. **Coverage discovery** - Find gaps in what Buoy can scan
3. **Feature inspiration** - Discover drift patterns in the wild

## Quick Start

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Set up environment
cp .env.example .env
# Edit .env with your GitHub token

# Discover repos with design systems
./dist/cli.js discover search

# List discovered repos
./dist/cli.js registry list
```

## Commands

### Discovery

```bash
# Search GitHub for repos with design systems
buoy-test discover search --min-score 8 --min-stars 100

# Add a specific repo
buoy-test discover add facebook/react
```

### Registry

```bash
# List repos in registry
buoy-test registry list --top 20

# Filter by signal
buoy-test registry list --signal storybook

# Show statistics
buoy-test registry stats

# Remove a repo
buoy-test registry remove owner/name
```

### Testing

```bash
# Test a single repo
buoy-test run single owner/name

# Test top N repos from registry
buoy-test run batch --top 10

# Test with custom concurrency
buoy-test run batch --top 20 --concurrency 3

# Test only untested repos
buoy-test run batch --untested-only
```

### Cache Management

```bash
# Show cache statistics
buoy-test cache status

# Clean old cached repos (default: 30 days)
buoy-test cache clean --max-age 30
```

### Reporting

```bash
# Generate aggregate report across all tested repos
buoy-test aggregate
```

### Assessment

Uses Claude to analyze test results and identify missed patterns.

```bash
# Assess a single repo
buoy-test assess single owner/name

# Assess all tested repos
buoy-test assess batch

# Skip repos that already have assessments
buoy-test assess batch --skip-existing

# Generate aggregate assessment summary
buoy-test assess summary
```

## Scoring

Repos are scored based on design system signals and activity:

| Signal | Points |
|--------|--------|
| Storybook | +3 |
| Design tokens | +3 |
| UI package | +3 |
| Figma config | +2 |
| CSS variables | +2 |
| Tailwind theme | +2 |
| Recent commits | +2 |
| CONTRIBUTING.md | +2 |
| High PR acceptance | +2 |
| Good first issues | +1 |
| 100+ stars | +1 |

Minimum score to be included: **5**

## Project Structure

```
buoy-lab/
├── src/
│   ├── discovery/      # GitHub search and repo scoring
│   ├── execution/      # Test runner and repo caching
│   ├── reporting/      # JSON/Markdown report generation
│   ├── assessment/     # Claude-powered analysis
│   ├── cli.ts          # CLI entry point
│   └── types.ts        # Core type definitions
├── registry/           # Discovered repo metadata
├── repos/              # Cloned repos (gitignored)
├── results/            # Test results and assessments
└── BUOY_ROADMAP.md     # Improvement roadmap from findings
```

## Tested Repositories

The following major design systems have been analyzed:

| Repository | Stars | Key Patterns |
|------------|-------|--------------|
| [chakra-ui/chakra-ui](https://github.com/chakra-ui/chakra-ui) | 40k+ | Ark UI wrappers, monorepo |
| [radix-ui/primitives](https://github.com/radix-ui/primitives) | 16k+ | Standard React, compound components |
| [shadcn-ui/ui](https://github.com/shadcn-ui/ui) | 75k+ | CVA pattern, registry variants |
| [mantinedev/mantine](https://github.com/mantinedev/mantine) | 30k+ | polymorphicFactory pattern |

Results and assessments are stored in `results/{owner}/{repo}/`.

## Requirements

- Node.js 20+
- pnpm
- GitHub token (for API access)
- Anthropic API key (for agent assessment)

## License

MIT
