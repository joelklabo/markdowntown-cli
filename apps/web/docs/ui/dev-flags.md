# UI Dev Flags

Use these NEXT_PUBLIC flags to stage UI changes safely in development. Flags are read at build time, so restart the dev server after changing values.

## How to enable

- Set a flag to "true" or "1" to enable.
- Set a flag to "false" or "0" to disable.
- Omit a flag to use its default (listed below).

## Flags

| Flag | Default | Purpose |
| --- | --- | --- |
| NEXT_PUBLIC_THEME_REFRESH_V1 | false | Enables theme refresh tokens and related UI tweaks (`data-theme-refresh` on root). |
| NEXT_PUBLIC_UX_CLARITY_V1 | false | Enables UX clarity improvements across core surfaces. |
| NEXT_PUBLIC_HEADER_STABILITY_V1 | false | Enables header stability fixes for banner + nav sizing. |
| NEXT_PUBLIC_INSTRUCTION_HEALTH_V1 | false | Enables instruction file health warnings and checks. |
| NEXT_PUBLIC_SCAN_CLARITY_V1 | false | Enables scan setup clarity improvements and guidance. |
| NEXT_PUBLIC_SCAN_NEXT_STEPS_V1 | false | Enables scan results next-step CTAs. |
| NEXT_PUBLIC_SCAN_QUICK_UPLOAD_V1 | false | Enables quick upload controls in scan flow. |
| NEXT_PUBLIC_WORDMARK_ANIM_V1 | true | Enables animated wordmark banner effects. |
| NEXT_PUBLIC_WORDMARK_BANNER_V1 | true | Enables the wordmark banner in the header. |

## Notes

- Header stability work should be tested with wordmark animation on and off.
- Theme refresh should be verified on `/tokens` (light/dark) after restarting the dev server.
- Scan clarity work should be tested with empty folders and missing instruction files.
- Scan clarity enables the scan setup guidance blocks and “What we scan” reference panel.
- If you see hydration mismatch warnings tied to theme or motion, verify cookies/localStorage values. The UI now defaults to stable SSR values and updates client preferences after hydration to avoid mismatches.
