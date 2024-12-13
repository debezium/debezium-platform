{{/*
Get the database secret name.
*/}}
{{- define "debezium-platform.secretName" -}}
{{- if .Values.database.enabled -}}
    {{ include "database.secretName" .Subcharts.database }}
{{- else -}}
    {{- required "A valid .Values.database.auth.existingSecret entry required!" .Values.database.auth.existingSecret -}}
{{- end -}}
{{- end -}}

{{/*
Get the offset config map name.
*/}}
{{- define "debezium-platform.offsetConfigMapName" -}}
{{- if empty .Values.conductor.offset.existingConfigMap -}}
    {{- printf "%s-%s" .Chart.Name "offsets" -}}
{{- else -}}
    {{- .Values.conductor.offset.existingConfigMap -}}
{{- end -}}
{{- end -}}

{{/*
Common labels
*/}}

{{- define "common.labels" -}}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}