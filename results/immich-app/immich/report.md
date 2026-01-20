# Buoy Test: immich-app/immich

**Score:** 5 | **Tested:** 2026-01-20 | **Buoy:** 0.2.19

**Status:** Completed successfully

## Design System Sources

No design system sources detected.

## Scan Results

| Type | Found | Coverage |
|------|-------|----------|
| Components | 332 | N/A |
| Tokens | 0 | N/A |

## Drift Signals

- **0** critical
- **42** warning
- **90** info

### By Type

| Type | Count |
|------|-------|
| hardcoded-value | 94 |
| semantic-mismatch | 37 |
| naming-inconsistency | 1 |

### Top Issues

1. `semantic-mismatch` in `web/src/lib/elements/GroupTab.svelte:1`
   Prop "selected" in "GroupTab" uses type "string" but other components use "boolean"
2. `semantic-mismatch` in `web/src/lib/elements/FormatMessage.svelte:1`
   Prop "children" in "FormatMessage" uses type "import('svelte').Snippet<[{ tag?: string" but other components use "Snippet"
3. `semantic-mismatch` in `web/src/lib/elements/Dropdown.svelte:1`
   Prop "title" in "Dropdown" uses type "string | undefined" but other components use "string"
4. `semantic-mismatch` in `web/src/lib/modals/SearchFilterModal.svelte:1`
   Prop "searchQuery" in "SearchFilterModal" uses type "MetadataSearchDto | SmartSearchDto" but other components use "string"
5. `semantic-mismatch` in `web/src/lib/modals/AssetChangeDateModal.svelte:1`
   Prop "asset" in "AssetChangeDateModal" uses type "TimelineAsset" but other components use "AssetResponseDto"
6. `semantic-mismatch` in `web/src/lib/components/QueueCardButton.svelte:1`
   Prop "color" in "QueueCardButton" uses type "Colors" but other components use "Color"
7. `semantic-mismatch` in `web/src/lib/components/HeaderActionButton.svelte:1`
   Prop "action" in "HeaderActionButton" uses type "HeaderButtonActionItem" but other components use "ActionItem"
8. `hardcoded-value` in `web/src/lib/components/timeline/Scrubber.svelte:1`
   Component "Scrubber" has 2 hardcoded size values: 50px, 36px
9. `semantic-mismatch` in `web/src/lib/components/shared-components/user-avatar.svelte:1`
   Prop "label" in "UserAvatar" uses type "string | undefined" but other components use "string"
10. `semantic-mismatch` in `web/src/lib/components/shared-components/single-grid-row.svelte:1`
   Prop "children" in "SingleGridRow" uses type "import('svelte').Snippet<[{ itemCount: number" but other components use "Snippet"

---

## Metadata

- **Repository:** [immich-app/immich](https://github.com/immich-app/immich)
- **Stars:** 89303
- **Default Branch:** main
- **Language:** TypeScript
- **Duration:** 9.2s
- **Config Generated:** No
