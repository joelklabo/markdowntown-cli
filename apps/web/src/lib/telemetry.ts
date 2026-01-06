export const UI_TELEMETRY_EVENT = "mdt_ui_telemetry";

export type UiTelemetryEventName =
  | "session_start"
  | "scan_start"
  | "scan_complete"
  | "scan_cancel"
  | "scan_results_cta"
  | "scan_next_step_click"
  | "cli_login_start"
  | "cli_login_success"
  | "cli_login_failure"
  | "cli_upload_start"
  | "cli_upload_success"
  | "cli_upload_failure"
  | "cli_patch_pull_start"
  | "cli_patch_pull_success"
  | "cli_patch_pull_failure"
  | "cli_error";

export type UiTelemetryEventDetail = {
  name: UiTelemetryEventName;
  properties?: Record<string, unknown>;
};

export function emitUiTelemetryEvent(detail: UiTelemetryEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(UI_TELEMETRY_EVENT, { detail }));
}
