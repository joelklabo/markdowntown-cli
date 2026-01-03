# Living City Wordmark Events Spec

## Objective
Define the event-to-visual mapping for the living city wordmark so site activity produces readable, delightful micro-animations without overwhelming the header.

## Event Channel
- Client dispatch: `dispatchCityWordmarkEvent` via `CITY_WORDMARK_EVENT` (see `src/components/wordmark/sim/events.ts`).
- Payload type: `CityWordmarkEvent` (see `src/components/wordmark/sim/types.ts`).

## Event Types and Reactions
### 1) search
- **Payload:** `{ type: "search", query: string }`
- **Visual Reaction:**
  - Spawn a short burst of **car** actors that cruise through the skyline.
- **Cadence:** Throttled in the engine to avoid spam.

### 2) command_palette_open
- **Payload:** `{ type: "command_palette_open", origin?: string }`
- **Visual Reaction:**
  - Spawn a small group of **pedestrians** to suggest foot traffic.
- **Cadence:** Throttled in the engine to avoid spam.

### 3) publish
- **Payload:** `{ type: "publish", kind?: "artifact" | "template" | "snippet" | "file" }`
- **Visual Reaction:**
  - Spawn a **truck** actor (delivery / publish moment).
- **Cadence:** Throttled in the engine to avoid spam.

### 4) alert: ambulance
- **Payload:** `{ type: "alert", kind: "ambulance" }`
- **Visual Reaction:**
  - Spawn an ambulance actor with siren lights (existing behavior).
- **Cadence:** Throttled in the engine to avoid spam.

### 5) upload
- **Payload:** `{ type: "upload", kind?: "file" | "asset" }`
- **Visual Reaction:**
  - Spawn a **dog** actor (dog walkers pop up).
- **Cadence:** Throttled in the engine to avoid spam.

### 6) login
- **Payload:** `{ type: "login", method?: "oauth" | "demo" }`
- **Visual Reaction:**
  - Spawn a **pedestrian** bundle to represent foot traffic.
- **Cadence:** Throttled in the engine to avoid spam.

## Rate Limiting and Concurrency
- Rate limiting is handled inside the event bridge and engine to keep reactions light.
- Event actors are short-lived (TTL in the sim engine) and capped per frame.

## Priority Order
1. ambulance alert
2. publish
3. command palette
4. search
5. upload
6. login

## Performance Constraints
- All reactions must be deterministic and avoid per-frame allocations.
- Reactions should not add more than ~120 extra rects per frame.

## Telemetry (Optional)
- If useful, log event counts client-side for tuning.
- Do not persist user-identifiable data in events.
