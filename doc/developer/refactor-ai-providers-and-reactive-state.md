# Developer Documentation: AI Providers & Reactive State Refactor

## 1. Multi-Provider AI Architecture

To support a wide range of AI models, the extension now uses a pluggable provider architecture.

### Key Providers:
- **MemCool**: The original, optimized provider.
- **OpenRouter**: Access to a broad list of models (GPT, Grok, DeepSeek, etc.) via the OpenRouter API.
- **Gemini (Direct)**: Official integration using the `@google/genai` SDK.

### Robust Prefix-Based Routing:
We implemented an explicit routing system in `background.ts`. Model IDs are now prefixed to ensure they are directed to the correct service:
- `memcool:<id>` -> `MemCoolExplainer`
- `openrouter:<id>` -> `OpenRouterExplainer`
- `gemini:<id>` -> `GeminiExplainer`

This removes ambiguity and allows for a clean, non-fallback routing logic.

## 2. Svelte 5 & Runes Refactoring

The extension's state management was modernized to leverage Svelte 5 features.

### Reactive Middleware (`modal.svelte.ts`):
Renamed from `modal.ts` to enable the use of Svelte 5 runes outside of components. It manages a global `$state` object for the modal's props, keeping them synchronized with `chrome.storage.sync` via a listener.

### Buffered Atomic Updates (`Modal.svelte`):
To allow users to "experiment" with different models in the modal without polluting their global settings immediately, we use a **Buffered State** pattern:
- **`$state` + `$effect`**: Used instead of `$derived` because local UI state (like dropdown selection) must be writable. The `$effect` keeps the local UI in sync with global setting changes, while `$state` allows for local, uncommitted changes.
- **Atomic Commitment**: Changes are only saved to `chrome.storage.sync` when the user explicitly clicks the "Stop and Retry" or "Try Again" button.

## 3. Interactive Recovery Features

### Text Shortener:
When a user selects more than 20 words (a business logic constraint), the error UI now provides an editable textarea. This allows users to shorten their selection directly in the modal and retry immediately.

### Stop and Retry:
Added a customizable `responseTimeout` (default 5s). If a request is slow, a "Stop and Retry" UI slides in from the bottom.
- **Visual Feedback**: When clicked, the skeleton animation pauses and dims for 1.5s to provide a tactile sense of interruption.
- **Request Tracking**: Implemented `currentRequestId` to ensure that if a request is cancelled and retried, stale responses from the previous request are ignored.

## 4. Privacy & Security

API keys for OpenRouter and Gemini are now **user-provided**. They are stored securely in local browser storage (`chrome.storage.sync`) and are never bundled with the extension's source code. The UI for entering these keys appears dynamically in both the Options page and the Modal fallback screen.
