# Debugging (Chrome Extension)

This project uses Vite + CRXJS. The fastest debug loop is:

1. Build in watch mode with sourcemaps
2. Load the unpacked extension in Chrome from `dist/`

## Quickstart

```bash
pnpm dev:watch
```

Then open Chrome and load the unpacked extension from `dist/`:

1. Visit `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist/` folder

## WSL2 + Windows

If you want Windows Chrome to access the WSL build output, create a Windows symlink:

```powershell
cmd /c mklink /D D:\dist "\\wsl.localhost\Ubuntu-24.04\home\ldd\memit\dist"
```

Then load `D:\dist` as the unpacked extension in Chrome.

## Notes

- For first-time setup, Chrome may show the "Developer mode" warning. That’s expected.
- Use the Sources panel to debug TS/ESM; sourcemaps are enabled in `--mode development` builds.
