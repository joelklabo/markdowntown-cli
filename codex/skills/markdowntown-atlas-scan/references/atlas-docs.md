# Atlas scan docs distilled

## Key user flow
- Scan a folder (preferred) or use directory upload fallback.
- Show loaded files, missing files, and scan metadata.
- Provide a primary CTA to open Workbench.

## Edge cases
- Permission denied or canceled picker: keep previous results, show guidance.
- Empty scan: show "no files found" guidance.
- Truncated scan: explain limits and suggest narrower scope.

## Next steps panel
- Summarize scan status above CTAs.
- Offer actions: open Workbench, rescan with different tool, adjust cwd.
