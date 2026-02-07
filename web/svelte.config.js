import adapter from "@sveltejs/adapter-static";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      // Cloudflare Pages: upload the contents of `dist/`.
      pages: "dist",
      assets: "dist",
      // Keep this as 404 for a fully prerendered site.
      // If you later switch to SPA-style routing (non-prerendered routes),
      // change to "200.html" and add an appropriate redirect rule.
      fallback: "404.html",
    }),
  },
};

export default config;
