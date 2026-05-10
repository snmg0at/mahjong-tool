import { createRequestHandler } from "react-router";

export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    const handler = createRequestHandler(() => import("../build/server/index.js"), process.env.NODE_ENV);
    return handler(request, { cloudflare: { env, ctx } });
  },
};
