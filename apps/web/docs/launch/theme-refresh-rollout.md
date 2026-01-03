# Theme Refresh Rollout Plan
Date: 2025-12-20
Owner: markdowntown-x8l6

## Goal
Safely ship the visual refresh (header + spacing + tabs) behind a feature flag with clear monitoring and rollback steps.

## Rollout Steps
1) **Flag default off**
   - Guard the new theme with `NEXT_PUBLIC_THEME_REFRESH_V1`.
   - Ensure both light and dark variants are available under the flag.

2) **Internal enablement**
   - Enable for internal staff and dogfood environment.
   - Validate top flows (home, library, workbench, docs) in light/dark.

3) **Canary release (5–10%)**
   - Enable flag for a small percentage of users.
   - Monitor performance + feedback for 48 hours.

4) **Ramp to 25–50%**
   - Continue monitoring metrics and support tickets.
   - Verify that visual regressions are not reported.

5) **Full rollout (100%)**
   - Remove old overrides once stable for 1–2 weeks.
   - Keep rollback option available for one release cycle.

## Monitoring Checklist
- **Core Web Vitals:** CLS, LCP, INP per route.
- **Conversion:** sign-in and “use template” CTR.
- **Engagement:** search use, workbench usage time.
- **Errors:** frontend errors/hydration warnings.
- **Feedback:** support tickets, user feedback tags.

## Rollback Criteria
- CLS or LCP regression > 10% on any core route.
- Spike in error rate or hydration warnings.
- Qualitative feedback indicating readability or usability issues.

## Rollback Steps
1) Disable `NEXT_PUBLIC_THEME_REFRESH_V1`.
2) Revert any additional palette overrides if required.
3) Re-run smoke + visual checks to confirm stability.

## Light/Dark Coverage
- Verify light/dark for `/`, `/library`, `/workbench`, `/docs`.
- Confirm tab picker contrast and focus rings in both modes.
- Visit `/tokens` to confirm the theme refresh flag state and review primary/surface token colors.
- Spot-check primary CTA text contrast in light mode (buttons, tabs, pagination).
