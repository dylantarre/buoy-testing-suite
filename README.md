# Buoy Testing Suite

Test harness for stress-testing [Buoy](https://github.com/dylantarre/buoy-design) against real-world open source projects with design systems.

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

### Testing (coming soon)

```bash
# Test a single repo
buoy-test run single owner/name

# Test top N repos
buoy-test run batch --top 10
```

### Assessment (coming soon)

```bash
# Run full agent assessment
buoy-test assess owner/name
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
buoy-testing-suite/
├── src/
│   ├── discovery/      # GitHub search and scoring
│   ├── execution/      # Test execution pipeline
│   ├── reporting/      # Report generation
│   ├── assessment/     # Agent orchestration
│   └── cli.ts          # CLI entry point
├── registry/           # Discovered repos
├── repos/              # Cloned repos (gitignored)
└── results/            # Test results
```

## Requirements

- Node.js 20+
- pnpm
- GitHub token (for API access)
- Anthropic API key (for agent assessment)

## License

MIT
