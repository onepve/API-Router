# Model Forwarding Verification

Date: 2026-07-17

## Method

- Started an isolated router on port 8091 with a temporary copy of `config.yaml`.
- Sent requests through the router, not directly to upstream providers.
- Used minimal chat, Responses, and image requests selected from each model's configured `type`.
- Used a forced streaming function call for `grok-4.5`.
- Reports exclude API keys, authorization headers, prompts beyond the fixed test text, and response bodies.

## Results

| Model | Route | Status | Duration | Usage | Notes |
| --- | --- | ---: | ---: | --- | --- |
| `deepseek-v4-flash-free` | `/v1/chat/completions` | 200 | 3062 ms | present | Passed after upstream path-prefix fix |
| `deepseek-v4-flash` | `/v1/chat/completions` | 200 | 1451 ms | present | Shared endpoint pool |
| `deepseek-v4-pro` | `/v1/chat/completions` | 200 | 2333 ms | present | Weighted dedicated endpoint selected |
| `deepseek-ai/deepseek-v4-flash` | `/v1/chat/completions` | 200 | 42610 ms | present | Slow but completed successfully |
| `deepseek-v4-flash[1m]` | `/v1/chat/completions` | 200 | 1098 ms | present | Redirect alias resolved successfully |
| `deepseek-v4-pro[1m]` | `/v1/chat/completions` | 200 | 1487 ms | present | Redirect alias resolved successfully |
| `sensenova-6.7-flash-lite` | `/v1/chat/completions` | 200 | 612 ms | present | Shared endpoint pool |
| `sensenova-u1-fast` | `/v1/images/generations` | 200 | 5464 ms | present | Used supported `2048x2048` size |
| `grok-4.5` | `/v1/chat/completions` | 200 | 18823 ms | stream | Streaming tool call passed |
| `codex-auto-review` | `/v1/responses` | 200 | 3025 ms | present | Responses API forwarding passed |
| `gpt-5.4` | `/v1/responses` | 200 | 5891 ms | present | Concrete representative of configured regex |

## grok-4.5 Streaming Tool Call

- Content type: `text/event-stream`
- SSE events: 18 on the final verification run
- Finish reason: `tool_calls`
- Tool name: `get_weather`
- Reconstructed arguments: `{"city":"Hong Kong"}`
- Argument JSON parsed successfully
- SSE parse errors: none
- Deterministic regression test confirms the stream wrapper forwards tool-call bytes unchanged

## Defects Found and Corrected

### Upstream path prefixes were dropped

`https://opencode.ai/zen/v1` combined with `/v1/chat/completions` previously became `https://opencode.ai/v1/chat/completions`, dropping `/zen`. This produced a 404 HTML response for `deepseek-v4-flash-free`.

The router now preserves any path prefix before `/v1`, producing `https://opencode.ai/zen/v1/chat/completions`. A regression test covers this URL construction.

### Image probe used an unsupported size

The initial `1024x1024` SenseNova probe returned 400 with the provider's supported-size list. The verifier now uses `2048x2048`; the routed request returned 200.

## Automated Evidence

- `deno test --allow-read --allow-write --allow-env`: 37 passed, 0 failed.
- `deno check src/main.ts scripts/verify_models.ts`: passed.
