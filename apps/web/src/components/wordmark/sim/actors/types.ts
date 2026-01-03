import type { CityWordmarkLayout, CityWordmarkVoxelRect } from "../layout";
import type { CityWordmarkConfig } from "../types";

export type CityWordmarkActorTone = "car" | "ambulance" | "headlight" | "sirenRed" | "sirenBlue" | "pedestrian" | "dog";

export type CityWordmarkActorRect = CityWordmarkVoxelRect & {
  tone: CityWordmarkActorTone;
  opacity?: number;
};

export type CityWordmarkActorContext = {
  config: CityWordmarkConfig;
  layout: CityWordmarkLayout;
};

export type CityWordmarkActorUpdateContext = CityWordmarkActorContext & {
  nowMs: number;
  dtMs: number;
};

export type CityWordmarkActorRenderContext = CityWordmarkActorContext & {
  nowMs: number;
};

export type CityWordmarkActor = {
  kind: string;
  done?: boolean;
  update: (ctx: CityWordmarkActorUpdateContext) => CityWordmarkActor;
  render: (ctx: CityWordmarkActorRenderContext) => CityWordmarkActorRect[];
};

export function getActorScale(layout: CityWordmarkLayout): number {
  return Math.max(1, Math.floor(layout.gridScale));
}

export function getActorLaneY(layout: CityWordmarkLayout, rows: number): number {
  const scale = getActorScale(layout);
  return Math.max(0, layout.baselineY - rows * scale);
}
