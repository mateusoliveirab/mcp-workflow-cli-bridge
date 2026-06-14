# Provider Adapter Contract

Provider adapters translate the broker's normalized request into concrete CLI
or SDK calls.

## Request

```json
{
  "runId": "uuid",
  "workflow": "generate-blog-image",
  "phase": "Create",
  "label": "create:iter1",
  "agentType": "vastitas-creator",
  "provider": "codex",
  "model": "default",
  "cwd": "/path/to/portfolio-blog",
  "prompt": "string",
  "schema": {},
  "attachments": [
    {
      "type": "image",
      "path": "public/blog/foo/iterations/iter1.png"
    }
  ],
  "sandbox": "read-only",
  "timeoutMs": 300000,
  "maxRetries": 2,
  "env": {
    "GEMINI_API_KEY": "redacted"
  }
}
```

## Response

```json
{
  "ok": true,
  "runId": "uuid",
  "provider": "codex",
  "phase": "Create",
  "label": "create:iter1",
  "durationMs": 12000,
  "attempts": 1,
  "structured": true,
  "data": {},
  "text": "",
  "usage": {},
  "artifacts": [],
  "warnings": []
}
```

## Error response

```json
{
  "ok": false,
  "runId": "uuid",
  "provider": "codex",
  "phase": "Create",
  "label": "create:iter1",
  "durationMs": 12000,
  "attempts": 3,
  "errorCode": "SCHEMA_VALIDATION_FAILED",
  "message": "Final output did not match schema.",
  "recoverable": true,
  "stderrTail": "string",
  "rawOutputPath": "logs/run-id/raw/codex-create-iter1.jsonl"
}
```

## Error codes

- `PROVIDER_NOT_FOUND`
- `PROVIDER_UNAVAILABLE`
- `UNSUPPORTED_SCHEMA`
- `UNSUPPORTED_ATTACHMENT`
- `UNSUPPORTED_SANDBOX`
- `AUTH_MISSING`
- `TIMEOUT`
- `PROCESS_EXIT_NONZERO`
- `OUTPUT_PARSE_FAILED`
- `SCHEMA_VALIDATION_FAILED`
- `PERMISSION_DENIED`
- `RATE_LIMITED`
- `CANCELLED`
- `UNKNOWN_PROVIDER_ERROR`

## Adapter requirements

Every adapter must:

1. accept the normalized request
2. enforce timeout
3. avoid passing unapproved environment variables
4. write raw stdout/stderr to audit logs
5. classify errors into known error codes
6. validate output when schema is provided
7. return only normalized response envelopes to the broker

## Codex adapter notes

Preferred invocation shape:

```bash
codex exec \
  --cd "$cwd" \
  --sandbox "$sandbox" \
  --output-schema "$schema_file" \
  --output-last-message "$output_file" \
  --image "$image_path" \
  "$prompt"
```

Use `--json` only when event-level details are needed. For normal structured
calls, `--output-last-message` plus schema validation is simpler.

## Claude adapter notes

Preferred invocation shape:

```bash
claude -p \
  --output-format json \
  --json-schema "$schema_json" \
  --agent "$agent" \
  --model "$model" \
  "$prompt"
```

This adapter is useful as a fallback and baseline, not as the primary bridge.

## OpenCode adapter notes

Start with CLI if faster:

```bash
opencode run \
  --dir "$cwd" \
  --format json \
  --agent "$agent" \
  --model "$model" \
  --file "$file" \
  "$prompt"
```

Prefer SDK if it provides stronger structured output and cleaner lifecycle
events.

## Gemini adapter notes

Expected invocation shape:

```bash
gemini \
  --prompt "$prompt" \
  --output-format json \
  --approval-mode plan
```

Until native schema enforcement is verified, Gemini schema calls must use:

1. strict prompt instruction
2. JSON extraction
3. AJV validation
4. bounded repair retries

