import { createRequestHandler } from "react-router";

type AssetsBinding = {
  fetch(request: Request): Promise<Response>;
};

type WorkerEnv = {
  ASSETS?: AssetsBinding;
};

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    if (env.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) return assetResponse;
    }

    const handler = createRequestHandler(() => import("../build/server/index.js"), process.env.NODE_ENV);
    return handler(request, { cloudflare: { env, ctx } });
  },
};
