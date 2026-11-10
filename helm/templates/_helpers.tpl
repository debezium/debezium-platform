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
Generates offset envs.
*/}}
{{- define "debezium-platform.offsetConfig" -}}
{{- if not .Values.offset.reusePlatformDatabase -}}
- name: OFFSET_JDBC_URL
  value: jdbc:postgresql://{{ .Values.offset.database.host }}:{{ .Values.offset.database.port }}/{{ .Values.offset.database.name }}
- name: OFFSET_JDBC_USERNAME
{{- if .Values.offset.database.auth.existingSecret }}
  valueFrom:
    secretKeyRef:
      name: {{ .Values.offset.database.auth.existingSecret }}
      key: username
{{- else }}
  value: {{ .Values.offset.database.username }}
{{- end }}
- name: OFFSET_JDBC_PASSWORD
{{- if .Values.offset.database.auth.existingSecret }}
  valueFrom:
    secretKeyRef:
      name: {{ .Values.offset.database.auth.existingSecret }}
      key: password
{{- else }}
  value: {{ .Values.offset.database.password }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Generates schema history envs.
*/}}
{{- define "debezium-platform.schemaHistoryConfig" -}}
{{- if not .Values.schemaHistory.reusePlatformDatabase -}}
- name: SCHEMA_HISTORY_JDBC_URL
  value: jdbc:postgresql://{{ .Values.schemaHistory.database.host }}:{{ .Values.schemaHistory.database.port }}/{{ .Values.schemaHistory.database.name }}
- name: SCHEMA_HISTORY_JDBC_USERNAME
{{- if .Values.schemaHistory.database.auth.existingSecret }}
  valueFrom:
    secretKeyRef:
      name: {{ .Values.schemaHistory.database.auth.existingSecret }}
      key: username
{{- else }}
  value: {{ .Values.schemaHistory.database.username }}
{{- end }}
- name: SCHEMA_HISTORY_JDBC_PASSWORD
{{- if .Values.schemaHistory.database.auth.existingSecret }}
  valueFrom:
    secretKeyRef:
      name: {{ .Values.schemaHistory.database.auth.existingSecret }}
      key: password
{{- else }}
  value: {{ .Values.schemaHistory.database.password }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}

{{- define "common.labels" -}}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/*
Get the scheme for the domain. An explicit .Values.domain.scheme wins; otherwise
it is derived from ingress TLS.
*/}}
{{- define "debezium-platform.domainScheme" -}}
{{- if .Values.domain.scheme -}}
{{ .Values.domain.scheme }}
{{- else if and .Values.ingress.enabled .Values.ingress.tls.enabled -}}
https
{{- else -}}
http
{{- end -}}
{{- end -}}

{{/*
Get the domain URL, with backward compatibility to deprecated .Values.domain.url.
*/}}
{{- define "debezium-platform.domainUrl" -}}
"{{ include "debezium-platform.domainScheme" . }}://{{ include "debezium-platform.domainName" . }}"
{{- end -}}

{{- define "debezium-platform.domainName" -}}
{{ default .Values.domain.name .Values.domain.url }}
{{- end -}}

{{/*
Converts a key to an environment variable name with a given prefix.
Usage: include "debezium-platform.toEnv" (dict "prefix" "PIPELINE_LABELS" "key" "argocd.argoproj.io/instance")
Result: PIPELINE_LABELS_ARGOCD_ARGOPROJ_IO_INSTANCE
*/}}
{{- define "debezium-platform.toEnv" -}}
{{ .prefix }}_{{ .key | upper | replace "." "_" | replace "/" "_" | replace "-" "_" }}
{{- end -}}

{{/*
Get the Prometheus URL. Required when monitoring.otel.enabled is true.
*/}}
{{- define "debezium-platform.prometheusUrl" -}}
{{- required "monitoring.prometheus.url is required when monitoring.otel.enabled is true" .Values.monitoring.prometheus.url -}}
{{- end -}}

{{/*
Directory the Prometheus CA ConfigMap or Secret is mounted at in the conductor container.
*/}}
{{- define "debezium-platform.prometheusCaMountPath" -}}
/etc/debezium/prometheus-ca
{{- end -}}

{{/*
Whether the chart mounts a Prometheus CA into the conductor: "true" when monitoring is enabled
and a CA ConfigMap or Secret is set, empty otherwise.
*/}}
{{- define "debezium-platform.prometheusCaMounted" -}}
{{- $tls := .Values.monitoring.prometheus.tls -}}
{{- if and .Values.monitoring.otel.enabled (or $tls.caConfigMap $tls.caSecret) -}}
true
{{- end -}}
{{- end -}}

{{/*
Path of the PEM CA bundle the conductor trusts for Prometheus, empty when none is configured.
Fails when more than one CA source is set.
*/}}
{{- define "debezium-platform.prometheusCaFile" -}}
{{- $tls := .Values.monitoring.prometheus.tls -}}
{{- if gt (len (compact (list $tls.caFile $tls.caConfigMap $tls.caSecret))) 1 -}}
{{- fail "only one of monitoring.prometheus.tls.caFile, caConfigMap and caSecret can be set" -}}
{{- end -}}
{{- if $tls.caFile -}}
{{- $tls.caFile -}}
{{- else if or $tls.caConfigMap $tls.caSecret -}}
{{- printf "%s/ca.crt" (include "debezium-platform.prometheusCaMountPath" .) -}}
{{- end -}}
{{- end -}}

{{/*
Environment variables carrying the Prometheus credentials and TLS trust to the conductor.
Fails when more than one authentication method is set.
*/}}
{{- define "debezium-platform.prometheusClientEnv" -}}
{{- $auth := .Values.monitoring.prometheus.auth -}}
{{- $methods := compact (list (ternary "serviceAccount" "" $auth.bearerToken.serviceAccount) $auth.bearerToken.existingSecret $auth.basic.existingSecret) -}}
{{- if gt (len $methods) 1 -}}
{{- fail "only one of monitoring.prometheus.auth.bearerToken.serviceAccount, auth.bearerToken.existingSecret and auth.basic.existingSecret can be set" -}}
{{- end -}}
{{- if $auth.bearerToken.serviceAccount }}
- name: MONITORING_PROMETHEUS_BEARER_TOKEN_FILE
  value: /var/run/secrets/kubernetes.io/serviceaccount/token
{{- else if $auth.bearerToken.existingSecret }}
- name: MONITORING_PROMETHEUS_BEARER_TOKEN
  valueFrom:
    secretKeyRef:
      name: {{ $auth.bearerToken.existingSecret }}
      key: {{ $auth.bearerToken.secretKey }}
{{- else if $auth.basic.existingSecret }}
- name: MONITORING_PROMETHEUS_BASIC_AUTH_USERNAME
  valueFrom:
    secretKeyRef:
      name: {{ $auth.basic.existingSecret }}
      key: username
- name: MONITORING_PROMETHEUS_BASIC_AUTH_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ $auth.basic.existingSecret }}
      key: password
{{- end }}
{{- with (include "debezium-platform.prometheusCaFile" .) }}
- name: QUARKUS_TLS_PROMETHEUS_TRUST_STORE_PEM_CERTS
  value: {{ . | quote }}
{{- end }}
{{- if .Values.monitoring.prometheus.tls.insecureSkipVerify }}
- name: QUARKUS_TLS_PROMETHEUS_TRUST_ALL
  value: "true"
- name: QUARKUS_TLS_PROMETHEUS_HOSTNAME_VERIFICATION_ALGORITHM
  value: "NONE"
{{- end }}
{{- end -}}

{{/*
Get the OpenTelemetry Collector resource name.
*/}}
{{- define "debezium-platform.otelCollectorName" -}}
{{- printf "%s-otel-collector" .Chart.Name -}}
{{- end -}}

{{/*
Get the OpenTelemetry Collector OTLP endpoint URL.
The OTel Operator creates a service named <collector-name>-collector for deployment mode.
*/}}
{{- define "debezium-platform.otelCollectorEndpoint" -}}
{{- printf "http://%s-collector.%s.svc.cluster.local:%d" (include "debezium-platform.otelCollectorName" .) .Release.Namespace (int .Values.monitoring.otel.collector.receivers.http.port) -}}
{{- end -}}