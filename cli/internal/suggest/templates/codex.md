# Codex Suggestions

{{- if .Suggestions }}
{{- range .Suggestions }}

- {{ .Text }}
  - Sources: {{ join .Sources ", " }}
{{- end }}

{{- else }}
_No suggestions available._
{{- end }}
