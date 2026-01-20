# Buoy Test: openreplay/openreplay

**Score:** 5 | **Tested:** 2026-01-20 | **Buoy:** 0.2.19

**Status:** Completed successfully

## Design System Sources

No design system sources detected.

## Scan Results

| Type | Found | Coverage |
|------|-------|----------|
| Components | 0 | N/A |
| Tokens | 0 | N/A |

## Drift Signals

- **0** critical
- **9** warning
- **51** info

### By Type

| Type | Count |
|------|-------|
| hardcoded-value | 60 |

### Top Issues

1. `hardcoded-value` in `frontend/app/withRecaptcha.tsx:16`
   1 arbitrary CSS property found. Consider using utility classes.
2. `hardcoded-value` in `frontend/app/components/IssuesSummary/IssueSessionsModal.tsx:104`
   3 arbitrary size values found. Consider using theme values.
3. `hardcoded-value` in `frontend/app/components/DataManagement/FilterEntriesModal.tsx:50`
   2 arbitrary size values found. Consider using theme values.
4. `hardcoded-value` in `frontend/app/components/Charts/SankeyChart.tsx:443`
   1 arbitrary size value found. Consider using theme values.
5. `hardcoded-value` in `frontend/app/components/Charts/PieChart.tsx:15`
   1 arbitrary CSS property found. Consider using utility classes.
6. `hardcoded-value` in `frontend/app/components/Charts/ColumnChart.tsx:12`
   1 arbitrary CSS property found. Consider using utility classes.
7. `hardcoded-value` in `frontend/app/components/Alerts/AlertForm.tsx:262`
   1 arbitrary size value found. Consider using theme values.
8. `hardcoded-value` in `frontend/app/components/ui/Pagination/Pagination.tsx:82`
   1 arbitrary size value found. Consider using theme values.
9. `hardcoded-value` in `frontend/app/components/ui/Input/Input.tsx:15`
   1 arbitrary CSS property found. Consider using utility classes.
10. `hardcoded-value` in `frontend/app/components/ui/Form/Form.tsx:6`
   2 arbitrary CSS properties found. Consider using utility classes.

---

## Metadata

- **Repository:** [openreplay/openreplay](https://github.com/openreplay/openreplay)
- **Stars:** 11662
- **Default Branch:** main
- **Language:** TypeScript
- **Duration:** 9.8s
- **Config Generated:** No
