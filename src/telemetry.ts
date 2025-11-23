import { opentelemetry } from '@elysiajs/opentelemetry'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'

// Configure OpenTelemetry only if OTEL endpoint is provided
export function createTelemetryPlugin() {
  const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT

  if (!otelEndpoint) {
    // Return a no-op plugin if telemetry is not configured
    return (app: any) => app
  }

  return opentelemetry({
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: otelEndpoint,
        })
      ),
    ],
  })
}
