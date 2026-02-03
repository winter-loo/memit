# Memit Web UI

This is the web interface for the Memit project, built with SvelteKit and configured for static deployment.

## Development

The project uses environment files (`.env.dev` and `.env.prod`) to manage configurations for different environments.

### Prerequisites

- Node.js and npm
- Access to Supabase credentials (stored in `~/credentials/supabase.txt`)

### Available Scripts

- **`pnpm run dev`**: Generates development `.env` and starts the development server.
- **`pnpm run build`**: Generates production `.env` and builds the static site to the `dist/` directory.

## Environment Configuration

The following environment variables are required and managed via `.env` files:

- `PUBLIC_API_BASE_URL`: The base URL for the backend API.
- `PUBLIC_SUPABASE_URL`: Your Supabase project URL.
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Your Supabase anonymous/public key.

## Deployment

The project is configured with `@sveltejs/adapter-static` for deployment to static hosting providers like Cloudflare Pages.

- **Build Output**: `dist/`
- **Fallback**: `404.html` (SPA mode)

For CI/CD deployment details, refer to the workflows in `.github/workflows/deploy-ui.yml`.
