Looking at the sampled files from the primer/react repository, Buoy has significantly under-detected what should be a rich design system implementation. This is GitHub's Primer Design System - one of the most well-known design systems in the industry - yet Buoy found almost nothing.

## Major Gaps Identified

### 1. Missed Components
The most glaring issue is that Buoy detected **0 components** despite this being a React component library. The `Button.tsx` files clearly show sophisticated component implementations:

- `packages/react/src/Button/Button.tsx` contains a polymorphic Button component using `forwardRef` and a special `__SLOT__` symbol system
- `packages/styled-react/src/components/Button.tsx` shows a styled-components wrapper with complex sx prop handling

These are clearly design system components with proper TypeScript definitions, prop interfaces, and design system patterns.

### 2. Missed Design Tokens
The styled Button component shows evidence of a token-based system with CSS custom properties like `--button-color` and data attributes for variants (`data-size`, `data-block`, etc.). The configuration only scanned 3 token files, but a design system of this scale likely has many more token definitions spread across the codebase.

### 3. Missed Source Coverage
Buoy's configuration is scanning very limited paths. The repository structure shows multiple packages (`packages/react/`, `packages/styled-react/`, etc.) but the configuration only targets a few specific files rather than doing comprehensive discovery.

### 4. Detection Pattern Issues
The component detection seems to be missing several React patterns:
- `forwardRef` components
- Polymorphic components with `as` props
- Components with special markers like `__SLOT__`
- Styled-components implementations
- Components that re-export from other packages

```json
{
  "missedPatterns": [
    {
      "category": "component",
      "description": "forwardRef polymorphic Button component with slot marker system",
      "evidence": {
        "file": "packages/react/src/Button/Button.tsx",
        "lineRange": [1, 20],
        "codeSnippet": "const ButtonComponent = forwardRef(({children, ...props}, forwardedRef): JSX.Element => {\n  return (\n    <ButtonBase ref={forwardedRef} as=\"button\" type=\"button\" {...props}>\n      {children}\n    </ButtonBase>\n  )\n}) as PolymorphicForwardRefComponent<'button', ButtonProps>\n\nButtonComponent.displayName = 'Button'\nButtonComponent.__SLOT__ = Symbol('Button')"
      },
      "suggestedDetection": "Detect forwardRef calls with displayName and __SLOT__ patterns as design system components",
      "severity": "high"
    },
    {
      "category": "component",
      "description": "Styled-components wrapper with sx prop system and data attributes",
      "evidence": {
        "file": "packages/styled-react/src/components/Button.tsx",
        "lineRange": [8, 15],
        "codeSnippet": "const StyledButtonComponent: ForwardRefComponent<'button', ButtonComponentProps> = styled(PrimerButton).withConfig({\n  shouldForwardProp: prop => (prop as keyof ButtonComponentProps) !== 'sx',\n})<ButtonComponentProps>`\n  ${sx}\n`"
      },
      "suggestedDetection": "Detect styled() calls that wrap other components as design system component extensions",
      "severity": "high"
    },
    {
      "category": "token",
      "description": "CSS custom properties used as design tokens in component styling",
      "evidence": {
        "file": "packages/styled-react/src/components/Button.tsx",
        "lineRange": [25, 30],
        "codeSnippet": "const {color} = sx as {color?: string}\nif (color) style['--button-color'] = color"
      },
      "suggestedDetection": "Scan for CSS custom properties (--*) being set dynamically as potential design tokens",
      "severity": "medium"
    },
    {
      "category": "token",
      "description": "Data attribute variants as design token system",
      "evidence": {
        "file": "packages/styled-react/src/components/Button.tsx",
        "lineRange": [50, 55],
        "codeSnippet": "const size = `[data-size=\"${props.size}\"]`\nconst block = props.block ? `[data-block=\"block\"]` : ''\nconst noVisuals = props.leadingVisual || props.trailingVisual || props.trailingAction ? '' : '[data-no-visuals]'"
      },
      "suggestedDetection": "Detect data-* attribute patterns used for component variants as token-like systems",
      "severity": "medium"
    },
    {
      "category": "source",
      "description": "Entire packages directory not comprehensively scanned",
      "evidence": {
        "file": "packages/react/src/Button/Button.tsx",
        "lineRange": [1, 1],
        "codeSnippet": "// This file exists but wasn't in Buoy's scan paths"
      },
      "suggestedDetection": "Auto-discover component files in packages/ directories for monorepo structures",
      "severity": "high"
    }
  ],
  "improvements": [
    {
      "area": "scanner",
      "title": "Monorepo package discovery",
      "description": "Automatically discover and scan all packages in workspaces-based monorepos instead of requiring manual file specification",
      "examples": [
        "packages/react/src/**/*.tsx",
        "packages/styled-react/src/**/*.tsx"
      ],
      "estimatedImpact": "Would catch 100+ components across multiple packages"
    },
    {
      "area": "scanner",
      "title": "React pattern recognition",
      "description": "Improve detection of React component patterns including forwardRef, polymorphic components, and styled-components",
      "examples": [
        "forwardRef(() => {}) as PolymorphicForwardRefComponent",
        "styled(Component).withConfig({})"
      ],
      "estimatedImpact": "Would catch all missed React components"
    },
    {
      "area": "token-parser",
      "title": "CSS custom property detection",
      "description": "Scan for CSS custom properties being dynamically set as they often represent design tokens",
      "examples": [
        "style['--button-color'] = color",
        "--primary-color: var(--token-primary)"
      ],
      "estimatedImpact": "Would find 20+ CSS custom property tokens"
    },
    {
      "area": "token-parser",
      "title": "Data attribute variant system detection",
      "description": "Recognize data-* attributes used for component variants as a token-like system for styling variations",
      "examples": [
        "data-size=\"small\"",
        "data-variant=\"primary\""
      ],
      "estimatedImpact": "Would identify variant token systems"
    },
    {
      "area": "config",
      "title": "Design system heuristics",
      "description": "Use package.json and README.md content to auto-configure scan patterns for known design system structures",
      "examples": [
        "Description contains 'Design System'",
        "Package name contains 'primer', 'react', 'ui'"
      ],
      "estimatedImpact": "Would provide better default configuration"
    }
  ],
  "summary": {
    "totalMissed": 5,
    "missedByCategory": {
      "component": 2,
      "token": 2,
      "drift": 0,
      "source": 1
    },
    "improvementAreas": [
      "scanner",
      "token-parser",
      "config"
    ]
  }
}
```