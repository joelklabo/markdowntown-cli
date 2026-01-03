# Living City Wordmark

This folder documents the Living City wordmark system (HD voxel banner + event-driven reactions).

## What it is
- A voxel-style wordmark that animates across the full-width header.
- A simulation engine that spawns actors (cars, pedestrians, trucks, dogs, ambulance) and window light effects.
- An event bridge that turns site activity into visible reactions.

## Where it lives
- Header banner: `src/components/SiteNav.tsx` renders `LivingCityWordmark`.
- Labs playground: `src/app/labs/city-logo` with `CityLogoControls`.
- Engine + actors: `src/components/wordmark/sim/*`.

## HD defaults
- Default voxel scale is **3** and `detail = "hd"`.
- Higher detail assets are defined in `src/components/wordmark/sim/glyphs.ts`.
- The banner can be extended via `render.bannerScale`.

## Event reactions
Events are dispatched client-side and listened to by the wordmark engine.
See `docs/wordmark/EVENTS_SPEC.md` and `docs/wordmark/LEGEND_SPEC.md`.

Dispatch helper:
```ts
import { dispatchCityWordmarkEvent } from "@/components/wordmark/sim/events";

dispatchCityWordmarkEvent({ type: "search", query: "agents" });
```

## Feature flags
- `NEXT_PUBLIC_WORDMARK_ANIM_V1` (default on) controls animation.
- `NEXT_PUBLIC_WORDMARK_BANNER_V1` (default on) controls banner render + event handling.

## Labs usage
- Navigate to `/labs/city-logo`.
- Adjust **Voxel scale** and **Detail** for HD output.
- Use the **Legend** card to simulate event reactions.
- Share links via the controls to lock in a configuration.

