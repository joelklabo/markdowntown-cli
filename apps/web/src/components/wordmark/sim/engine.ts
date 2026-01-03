import type { CityWordmarkConfig } from "./types";
import { getDefaultCityWordmarkConfig, mergeCityWordmarkConfig } from "./config";
import type { CityWordmarkActor, CityWordmarkActorRect } from "./actors/types";
import { spawnCarActors } from "./actors/car";
import { spawnTruckActors } from "./actors/truck";
import { spawnAmbulanceActor } from "./actors/ambulance";
import { spawnStreetlightActors } from "./actors/streetlight";
import { spawnPedestrianActors } from "./actors/pedestrian";
import { getActorScale } from "./actors/types";
import { createCityWordmarkLayout } from "./layout";
import { createRng } from "./rng";
import { normalizeTimeOfDay } from "./time";
import { listenCityWordmarkEvents } from "./events";
import type { CityWordmarkEvent } from "./types";

export type CityWordmarkEngineListener = () => void;

export type CityWordmarkEngineSnapshot = Readonly<{
  nowMs: number;
  playing: boolean;
  config: CityWordmarkConfig;
  actorRects: readonly CityWordmarkActorRect[];
}>;

const FIXED_STEP_MS = 50;
const DAY_CYCLE_MS = 240_000;
const MAX_FRAME_MS = 250;
const EVENT_COOLDOWN_MS = 1_200;
const EVENT_ACTOR_TTL_MS = 5_500;
const EVENT_ACTOR_LIMIT = 6;

export type CityWordmarkEngine = Readonly<{
  getSnapshot: () => CityWordmarkEngineSnapshot;
  subscribe: (listener: CityWordmarkEngineListener) => () => void;
  setPlaying: (playing: boolean) => void;
  setConfig: (overrides: unknown) => void;
  setTimeOfDay: (timeOfDay: number) => void;
  step: (steps?: number) => void;
}>;

type FrameHandle = number | ReturnType<typeof setTimeout>;

function requestFrame(cb: (ts: number) => void): FrameHandle {
  if (typeof requestAnimationFrame === "function") {
    return requestAnimationFrame(cb);
  }
  return setTimeout(() => cb(Date.now()), 16);
}

function cancelFrame(id: FrameHandle) {
  if (typeof cancelAnimationFrame === "function" && typeof id === "number") {
    cancelAnimationFrame(id);
    return;
  }
  clearTimeout(id as ReturnType<typeof setTimeout>);
}

export function createCityWordmarkEngine(options: { initialConfig?: CityWordmarkConfig; initialPlaying?: boolean } = {}) {
  const listeners = new Set<CityWordmarkEngineListener>();
  const initialConfig = options.initialConfig ?? getDefaultCityWordmarkConfig();
  let layout = createCityWordmarkLayout({
    sceneScale: initialConfig.render.bannerScale,
    detail: initialConfig.render.detail,
    resolution: initialConfig.render.voxelScale,
  });
  let actors: CityWordmarkActor[] = [];

  let snapshot: CityWordmarkEngineSnapshot = {
    nowMs: 0,
    playing: options.initialPlaying ?? true,
    config: initialConfig,
    actorRects: [],
  };

  actors = [
    ...spawnCarActors({ config: snapshot.config, layout }),
    ...spawnTruckActors({ config: snapshot.config, layout }),
    ...spawnStreetlightActors({ config: snapshot.config, layout }),
    ...spawnPedestrianActors({ config: snapshot.config, layout }),
  ];
  snapshot = {
    ...snapshot,
    actorRects: actors.flatMap((actor) => actor.render({ nowMs: snapshot.nowMs, config: snapshot.config, layout })),
  };

  let handle: FrameHandle | null = null;
  let lastFrameMs: number | null = null;
  let accumulatorMs = 0;
  let unsubscribeEvents: (() => void) | null = null;
  let ambulanceTriggerIndex = 0;
  let eventIndex = 0;
  const lastEventAt = new Map<string, number>();

  function emit() {
    for (const listener of listeners) listener();
  }

  function stop() {
    if (!handle) return;
    cancelFrame(handle);
    handle = null;
    lastFrameMs = null;
    accumulatorMs = 0;
  }

  function maybeStart() {
    if (handle) return;
    if (!snapshot.playing) return;
    if (listeners.size === 0) return;
    handle = requestFrame(onFrame);
  }

  function maybeStop() {
    if (listeners.size !== 0 && snapshot.playing) return;
    stop();
  }

  function ensureEventListener() {
    if (unsubscribeEvents) return;
    unsubscribeEvents = listenCityWordmarkEvents(onCityWordmarkEvent);
  }

  function maybeStopEventListener() {
    if (!unsubscribeEvents) return;
    if (listeners.size !== 0) return;
    unsubscribeEvents();
    unsubscribeEvents = null;
  }

  function isEventThrottled(type: string, ts: number): boolean {
    const last = lastEventAt.get(type);
    if (last != null && ts - last < EVENT_COOLDOWN_MS) return true;
    lastEventAt.set(type, ts);
    return false;
  }

  function wrapEventActor(
    actor: CityWordmarkActor,
    kind: string,
    startMs: number,
    configOverride?: CityWordmarkConfig
  ): CityWordmarkActor {
    let inner = actor;
    const wrapper: CityWordmarkActor = {
      kind,
      update(ctx) {
        const updateCtx = configOverride ? { ...ctx, config: configOverride } : ctx;
        inner = inner.update(updateCtx);
        if (inner.done || ctx.nowMs - startMs >= EVENT_ACTOR_TTL_MS) {
          wrapper.done = true;
        }
        return wrapper;
      },
      render(ctx) {
        if (wrapper.done) return [];
        const renderCtx = configOverride ? { ...ctx, config: configOverride } : ctx;
        return inner.render(renderCtx);
      },
    };
    return wrapper;
  }

  function createEventDogActor(seed: string): CityWordmarkActor {
    const rng = createRng(`${seed}:dog`);
    const scale = getActorScale(layout);
    const bodyWidth = scale * 2;
    const headSize = scale;
    const maxX = Math.max(0, layout.sceneWidth - bodyWidth - headSize);
    const x = maxX > 0 ? rng.nextInt(0, maxX + 1) : 0;
    const y = Math.max(0, layout.baselineY - scale);

    const actor: CityWordmarkActor = {
      kind: "dog",
      update() {
        return actor;
      },
      render() {
        return [
          { x, y, width: bodyWidth, height: headSize, tone: "dog", opacity: 0.72 },
          { x: x + bodyWidth, y, width: headSize, height: headSize, tone: "dog", opacity: 0.62 },
        ];
      },
    };

    return actor;
  }

  function addEventActors(newActors: CityWordmarkActor[]) {
    if (newActors.length === 0) return;
    const base = actors.filter((actor) => !actor.kind.startsWith("event:"));
    const existing = actors.filter((actor) => actor.kind.startsWith("event:"));
    const merged = [...existing, ...newActors].slice(-EVENT_ACTOR_LIMIT);
    actors = [...base, ...merged];
  }

  function spawnEventActorBundle(
    event: CityWordmarkEvent,
    ts: number
  ): { actors: CityWordmarkActor[]; configOverride?: CityWordmarkConfig } | null {
    const seed = `${snapshot.config.seed}:event:${event.type}:${ts}:${eventIndex++}`;
    const baseConfig = snapshot.config;

    if (event.type === "search") {
      const config = mergeCityWordmarkConfig(baseConfig, { seed, density: "sparse", actors: { cars: true } });
      return { actors: spawnCarActors({ config, layout }), configOverride: config };
    }

    if (event.type === "command_palette_open") {
      const config = mergeCityWordmarkConfig(baseConfig, { seed, density: "sparse", actors: { pedestrians: true } });
      return { actors: spawnPedestrianActors({ config, layout }), configOverride: config };
    }

    if (event.type === "publish") {
      const config = mergeCityWordmarkConfig(baseConfig, { seed, density: "sparse", actors: { trucks: true } });
      return { actors: spawnTruckActors({ config, layout }), configOverride: config };
    }

    if (event.type === "upload") {
      return { actors: [createEventDogActor(seed)], configOverride: baseConfig };
    }

    if (event.type === "login") {
      const config = mergeCityWordmarkConfig(baseConfig, { seed, density: "sparse", actors: { pedestrians: true } });
      return { actors: spawnPedestrianActors({ config, layout }), configOverride: config };
    }

    return null;
  }

  function onCityWordmarkEvent(event: CityWordmarkEvent) {
    const ts = event.ts ?? Date.now();
    if (isEventThrottled(event.type, ts)) return;

    if (event.type === "alert" && event.kind === "ambulance") {
      if (!snapshot.config.actors.ambulance) return;

      const actor = spawnAmbulanceActor({
        config: snapshot.config,
        layout,
        nowMs: snapshot.nowMs,
        triggerIndex: ambulanceTriggerIndex++,
      });
      if (!actor) return;

      actors = [...actors.filter((a) => a.kind !== "ambulance"), actor];
      const actorRects = actors.flatMap((a) => a.render({ nowMs: snapshot.nowMs, config: snapshot.config, layout }));
      snapshot = { ...snapshot, actorRects };
      emit();
      return;
    }

    const bundle = spawnEventActorBundle(event, ts);
    if (!bundle || bundle.actors.length === 0) return;
    const startMs = snapshot.nowMs;
    const wrapped = bundle.actors.map((actor, index) =>
      wrapEventActor(actor, `event:${event.type}:${eventIndex}-${index}`, startMs, bundle.configOverride)
    );

    addEventActors(wrapped);
    const actorRects = actors.flatMap((a) => a.render({ nowMs: snapshot.nowMs, config: snapshot.config, layout }));
    snapshot = { ...snapshot, actorRects };
    emit();
  }

  function advance(stepMs: number) {
    const nextNowMs = snapshot.nowMs + stepMs;
    const nextTimeOfDay = normalizeTimeOfDay(
      snapshot.config.timeOfDay + (stepMs * snapshot.config.timeScale) / DAY_CYCLE_MS
    );

    const nextConfig = {
      ...snapshot.config,
      timeOfDay: nextTimeOfDay,
    };

    const updateCtx = { nowMs: nextNowMs, dtMs: stepMs, config: nextConfig, layout };
    actors = actors.map((actor) => actor.update(updateCtx)).filter((actor) => !actor.done);
    const actorRects = actors.flatMap((actor) => actor.render({ nowMs: nextNowMs, config: nextConfig, layout }));

    snapshot = {
      ...snapshot,
      nowMs: nextNowMs,
      config: nextConfig,
      actorRects,
    };
  }

  function onFrame(now: number) {
    if (!snapshot.playing || listeners.size === 0) {
      stop();
      return;
    }

    if (lastFrameMs == null) lastFrameMs = now;
    const frameDelta = Math.min(MAX_FRAME_MS, Math.max(0, now - lastFrameMs));
    lastFrameMs = now;
    accumulatorMs += frameDelta;

    const steps = Math.floor(accumulatorMs / FIXED_STEP_MS);
    if (steps > 0) {
      const stepMs = steps * FIXED_STEP_MS;
      accumulatorMs -= stepMs;
      advance(stepMs);
      emit();
    }

    handle = requestFrame(onFrame);
  }

  function getSnapshot(): CityWordmarkEngineSnapshot {
    return snapshot;
  }

  function subscribe(listener: CityWordmarkEngineListener): () => void {
    listeners.add(listener);
    ensureEventListener();
    maybeStart();
    return () => {
      listeners.delete(listener);
      maybeStop();
      maybeStopEventListener();
    };
  }

  function setPlaying(playing: boolean) {
    if (snapshot.playing === playing) return;
    snapshot = { ...snapshot, playing };
    emit();
    if (playing) {
      maybeStart();
    } else {
      maybeStop();
    }
  }

  function setConfig(overrides: unknown) {
    const nextConfig = mergeCityWordmarkConfig(snapshot.config, overrides);
    layout = createCityWordmarkLayout({
      sceneScale: nextConfig.render.bannerScale,
      detail: nextConfig.render.detail,
      resolution: nextConfig.render.voxelScale,
    });
    ambulanceTriggerIndex = 0;
    eventIndex = 0;
    lastEventAt.clear();
    actors = [
      ...spawnCarActors({ config: nextConfig, layout }),
      ...spawnTruckActors({ config: nextConfig, layout }),
      ...spawnStreetlightActors({ config: nextConfig, layout }),
      ...spawnPedestrianActors({ config: nextConfig, layout }),
    ];
    const actorRects = actors.flatMap((actor) => actor.render({ nowMs: snapshot.nowMs, config: nextConfig, layout }));
    snapshot = { ...snapshot, config: nextConfig, actorRects };
    emit();
  }

  function setTimeOfDay(timeOfDay: number) {
    const nextConfig = { ...snapshot.config, timeOfDay: normalizeTimeOfDay(timeOfDay) };
    const actorRects = actors.flatMap((actor) => actor.render({ nowMs: snapshot.nowMs, config: nextConfig, layout }));
    snapshot = { ...snapshot, config: nextConfig, actorRects };
    emit();
  }

  function step(steps: number = 1) {
    const count = Math.max(0, Math.floor(steps));
    if (count === 0) return;
    advance(count * FIXED_STEP_MS);
    emit();
  }

  return {
    getSnapshot,
    subscribe,
    setPlaying,
    setConfig,
    setTimeOfDay,
    step,
  } satisfies CityWordmarkEngine;
}

export const defaultCityWordmarkEngine: CityWordmarkEngine = createCityWordmarkEngine();

export function getCityWordmarkEngineSnapshot(): CityWordmarkEngineSnapshot {
  return defaultCityWordmarkEngine.getSnapshot();
}

export function subscribeCityWordmarkEngine(listener: CityWordmarkEngineListener): () => void {
  return defaultCityWordmarkEngine.subscribe(listener);
}

export function setCityWordmarkEnginePlaying(playing: boolean) {
  defaultCityWordmarkEngine.setPlaying(playing);
}

export function setCityWordmarkEngineConfig(overrides: unknown) {
  defaultCityWordmarkEngine.setConfig(overrides);
}
