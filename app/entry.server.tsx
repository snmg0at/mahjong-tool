import { PassThrough } from "node:stream";
import type { EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { renderToReadableStream } from "react-dom/server";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext
) {
  const stream = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      signal: request.signal,
    }
  );

  responseHeaders.set("Content-Type", "text/html; charset=utf-8");

  return new Response(stream, {
    status: responseStatusCode,
    headers: responseHeaders,
  });
}
