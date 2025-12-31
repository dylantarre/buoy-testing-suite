Looking at this headless UI repository, Buoy has missed a significant amount of design system content. This is a component library that provides unstyled, accessible UI components designed to work with design systems - exactly what Buoy should excel at detecting.

## Analysis

### Major Missed Components
The most glaring omission is that Buoy found 0 components, yet this repository contains multiple well-defined React components:

1. **Button Components**: Both in the main packages and playgrounds, there are clear button component implementations with proper TypeScript interfaces, render prop patterns, and accessibility features.

2. **Input Components**: Similar to buttons, there are input components with full type definitions and accessibility integration.

3. **Component Architecture**: The components follow sophisticated patterns with render props, slot systems, and accessibility integrations that should be strong signals for component detection.

### Missed Design Tokens
While this library is intentionally unstyled, there are still design-related constants in the playground examples:

1. **Hardcoded Tailwind Classes**: The playground components contain repeated class patterns that represent implicit design tokens.

2. **Focus Ring Patterns**: Consistent focus styling patterns that could be considered design tokens.

### Detection Pattern Issues
Buoy seems to be missing several key patterns:

1. **Advanced Component Patterns**: The `forwardRefWithAs` pattern and render prop patterns aren't being recognized.

2. **TypeScript Component Interfaces**: Complex TypeScript component definitions with generic types.

3. **Workspace Structure**: The monorepo structure with packages might be confusing the scanner.

4. **Framework-Specific Patterns**: React-specific patterns like `forwardRef` and custom hook usage.

```json
{
  "missedPatterns": [
    {
      "category": "component",
      "description": "Button component with advanced TypeScript patterns and render props",
      "evidence": {
        "file": "packages/@headlessui-react/src/components/button/button.tsx",
        "lineRange": [25, 45],
        "codeSnippet": "export type ButtonProps<TTag extends ElementType = typeof DEFAULT_BUTTON_TAG> = Props<\n  TTag,\n  ButtonRenderPropArg,\n  ButtonPropsWeControl,\n  {\n    disabled?: boolean\n    autoFocus?: boolean\n    type?: 'button' | 'submit' | 'reset'\n  }\n>\n\nfunction ButtonFn<TTag extends ElementType = typeof DEFAULT_BUTTON_TAG>(\n  props: ButtonProps<TTag>,\n  ref: Ref<HTMLElement>\n) {"
      },
      "suggestedDetection": "Detect 'export type [ComponentName]Props' pattern and 'forwardRefWithAs' usage as component indicators",
      "severity": "high"
    },
    {
      "category": "component",
      "description": "Input component with accessibility integration and slot patterns",
      "evidence": {
        "file": "packages/@headlessui-react/src/components/input/input.tsx",
        "lineRange": [20, 40],
        "codeSnippet": "export type InputProps<TTag extends ElementType = typeof DEFAULT_INPUT_TAG> = Props<\n  TTag,\n  InputRenderPropArg,\n  InputPropsWeControl,\n  {\n    disabled?: boolean\n    invalid?: boolean\n    autoFocus?: boolean\n  }\n>\n\nfunction InputFn<TTag extends ElementType = typeof DEFAULT_INPUT_TAG>(\n  props: InputProps<TTag>,\n  ref: Ref<HTMLElement>\n) {"
      },
      "suggestedDetection": "Look for component functions with 'Fn' suffix and corresponding Props types, plus useSlot/useRender patterns",
      "severity": "high"
    },
    {
      "category": "component",
      "description": "Playground Button component with forwardRef pattern",
      "evidence": {
        "file": "playgrounds/react/components/button.tsx",
        "lineRange": [6, 18],
        "codeSnippet": "export let Button = forwardRef<\n  HTMLButtonElement,\n  ComponentProps<'button'> & { children?: ReactNode }\n>(({ className, ...props }, ref) => (\n  <button\n    ref={ref}\n    type=\"button\"\n    className={classNames(\n      'focus:outline-hidden ui-focus-visible:ring-2 ui-focus-visible:ring-offset-2 flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 ring-gray-500 ring-offset-gray-100',\n      className\n    )}\n    {...props}\n  />\n))"
      },
      "suggestedDetection": "Detect 'export let [ComponentName] = forwardRef' pattern as a component definition",
      "severity": "high"
    },
    {
      "category": "component",
      "description": "Playground Input component with similar forwardRef pattern",
      "evidence": {
        "file": "playgrounds/react/components/input.tsx",
        "lineRange": [6, 18],
        "codeSnippet": "export let Input = forwardRef<HTMLInputElement, ComponentProps<'input'> & { children?: ReactNode }>(\n  ({ className, ...props }, ref) => (\n    <input\n      ref={ref}\n      type=\"text\"\n      className={classNames(\n        'focus:outline-hidden ui-focus-visible:ring-2 ui-focus-visible:ring-offset-2 flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 ring-gray-500 ring-offset-gray-100',\n        className\n      )}\n      {...props}\n    />\n  )\n)"
      },
      "suggestedDetection": "Same forwardRef pattern detection needed for Input components",
      "severity": "high"
    },
    {
      "category": "token",
      "description": "Repeated Tailwind class patterns that could be considered design tokens",
      "evidence": {
        "file": "playgrounds/react/components/button.tsx",
        "lineRange": [12, 14],
        "codeSnippet": "'focus:outline-hidden ui-focus-visible:ring-2 ui-focus-visible:ring-offset-2 flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 ring-gray-500 ring-offset-gray-100'"
      },
      "suggestedDetection": "Detect repeated className patterns across components as implicit design tokens",
      "severity": "medium"
    },
    {
      "category": "drift",
      "description": "Duplicated styling patterns between Button and Input components",
      "evidence": {
        "file": "playgrounds/react/components/input.tsx",
        "lineRange": [11, 13],
        "codeSnippet": "'focus:outline-hidden ui-focus-visible:ring-2 ui-focus-visible:ring-offset-2 flex items-center rounded-md border border-gray-300 bg-white px-2 py-1 ring-gray-500 ring-offset-gray-100'"
      },
      "suggestedDetection": "Compare className strings across components to detect duplicated styling patterns",
      "severity": "medium"
    },
    {
      "category": "source",
      "description": "Monorepo package structure with component packages not being scanned properly",
      "evidence": {
        "file": "package.json",
        "lineRange": [7, 10],
        "codeSnippet": "\"workspaces\": [\n    \"packages/*\",\n    \"playgrounds/*\"\n  ]"
      },
      "suggestedDetection": "Improve workspace detection to recursively scan all workspace packages for components",
      "severity": "high"
    }
  ],
  "improvements": [
    {
      "area": "scanner",
      "title": "Advanced React Component Pattern Detection",
      "description": "Enhance scanner to recognize modern React patterns including forwardRefWithAs, render props with TypeScript generics, and complex component function patterns beyond basic component detection",
      "examples": [
        "forwardRefWithAs(ButtonFn) as _internal_ComponentButton",
        "export let Button = forwardRef<HTMLButtonElement, ComponentProps<'button'>",
        "Props<TTag, ButtonRenderPropArg, ButtonPropsWeControl>"
      ],
      "estimatedImpact": "Would catch 4+ components in this repo alone"
    },
    {
      "area": "config",
      "title": "Workspace-Aware Scanning",
      "description": "Improve workspace detection to automatically discover and scan all packages in monorepo structures, including nested package.json files and workspace configurations",
      "examples": [
        "packages/@headlessui-react/",
        "packages/@headlessui-vue/",
        "playgrounds/react/"
      ],
      "estimatedImpact": "Would discover entire component libraries in monorepos"
    },
    {
      "area": "token-parser",
      "title": "Implicit Design Token Detection",
      "description": "Detect repeated className patterns and styling strings as implicit design tokens, even in unstyled component libraries",
      "examples": [
        "focus:outline-hidden ui-focus-visible:ring-2",
        "rounded-md border border-gray-300 bg-white px-2 py-1"
      ],
      "estimatedImpact": "Would identify 5+ implicit token patterns"
    },
    {
      "area": "drift-rules",
      "title": "Cross-Component Style Drift Detection",
      "description": "Compare styling patterns across components to identify duplicated or inconsistent design implementations",
      "examples": [
        "Identical className strings in Button and Input components"
      ],
      "estimatedImpact": "Would catch 1+ drift pattern in this repo"
    },
    {
      "area": "scanner",
      "title": "TypeScript Component Interface Detection",
      "description": "Enhance TypeScript parsing to recognize component prop interfaces and render prop type definitions as component indicators",
      "examples": [
        "export type ButtonProps<TTag extends ElementType>",
        "type ButtonRenderPropArg = { disabled: boolean; hover: boolean; }"
      ],
      "estimatedImpact": "Would improve component detection accuracy by 50%"
    }
  ],
  "summary": {
    "totalMissed": 7,
    "missedByCategory": {
      "component": 4,
      "token": 1,
      "drift": 1,
      "source": 1
    },
    "improvementAreas": [
      "scanner",
      "config",
      "token-parser",
      "drift-rules"
    ]
  }
}
```