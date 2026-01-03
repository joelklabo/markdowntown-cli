'use client';

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { CityWordmarkConfig } from "./types";
import type { CityWordmarkActorRect } from "./actors/types";
import {
  defaultCityWordmarkEngine,
  type CityWordmarkEngine,
  type CityWordmarkEngineSnapshot,
} from "./engine";

const subscribeNoop = () => () => {};

type CityWordmarkSimSnapshot = CityWordmarkEngineSnapshot;

export type CityWordmarkSim = {
  nowMs: number;
  playing: boolean;
  config: CityWordmarkConfig;
  actorRects: readonly CityWordmarkActorRect[];
  peek: () => CityWordmarkSimSnapshot;
  setPlaying: (playing: boolean) => void;
  togglePlaying: () => void;
  setTimeOfDay: (timeOfDay: number) => void;
  step: (steps?: number) => void;
  setConfig: (overrides: unknown) => void;
};

export function useCityWordmarkSim(options: { enabled?: boolean; engine?: CityWordmarkEngine } = {}): CityWordmarkSim {
  const enabled = options.enabled ?? true;
  const engine = options.engine ?? defaultCityWordmarkEngine;
  const frozenDefaults = useMemo<CityWordmarkSimSnapshot>(() => {
    return { ...engine.getSnapshot(), playing: false };
  }, [engine]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!enabled) return subscribeNoop();
      let queued = false;
      const handle = () => {
        if (queued) return;
        queued = true;
        // Defer notifications to avoid updates firing while another component is rendering.
        const schedule = typeof queueMicrotask === "function" ? queueMicrotask : (cb: () => void) => Promise.resolve().then(cb);
        schedule(() => {
          queued = false;
          onStoreChange();
        });
      };
      return engine.subscribe(handle);
    },
    [enabled, engine]
  );

  const snapshot = useSyncExternalStore(subscribe, enabled ? engine.getSnapshot : () => frozenDefaults, () => frozenDefaults);

  const peek = useCallback(() => engine.getSnapshot(), [engine]);

  const setPlaying = useCallback(
    (playing: boolean) => {
      if (!enabled) return;
      engine.setPlaying(playing);
    },
    [enabled, engine]
  );

  const togglePlaying = useCallback(() => {
    if (!enabled) return;
    engine.setPlaying(!engine.getSnapshot().playing);
  }, [enabled, engine]);

  const setTimeOfDay = useCallback(
    (timeOfDay: number) => {
      if (!enabled) return;
      engine.setTimeOfDay(timeOfDay);
    },
    [enabled, engine]
  );

  const step = useCallback(
    (steps: number = 1) => {
      if (!enabled) return;
      engine.step(steps);
    },
    [enabled, engine]
  );

  const setConfig = useCallback(
    (overrides: unknown) => {
      if (!enabled) return;
      engine.setConfig(overrides);
    },
    [enabled, engine]
  );

  return useMemo(
    () => ({
      nowMs: snapshot.nowMs,
      playing: snapshot.playing,
      config: snapshot.config,
      actorRects: snapshot.actorRects,
      peek,
      setPlaying,
      togglePlaying,
      setTimeOfDay,
      step,
      setConfig,
    }),
    [
      peek,
      setConfig,
      setPlaying,
      setTimeOfDay,
      snapshot.actorRects,
      snapshot.config,
      snapshot.nowMs,
      snapshot.playing,
      step,
      togglePlaying,
    ]
  );
}
