export const UI_TELEMETRY_EVENT = "mdt_ui_telemetry";

export type UiTelemetryEventName =
  | "session_start"
  | "scan_start"
  | "scan_complete"
  | "scan_cancel"
  | "scan_results_cta"
  | "scan_next_step_click";

export type UiTelemetryEventDetail = {
  name: UiTelemetryEventName;
  properties?: Record<string, unknown>;
};

export function emitUiTelemetryEvent(detail: UiTelemetryEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(UI_TELEMETRY_EVENT, { detail }));
}
