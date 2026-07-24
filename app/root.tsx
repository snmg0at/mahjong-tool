import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

export default function App() {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <Meta />
        <Links />
        <style>{`
          html,
          body {
            width: 100%;
            min-height: 100%;
          }

          .app-orientation-shell {
            --app-width: 100vw;
            --app-height: 100svh;
            width: 100%;
            min-height: var(--app-height);
          }

          @media (orientation: portrait) and (max-width: 1024px) {
            html,
            body {
              height: 100%;
              overflow: hidden;
            }

            .app-orientation-shell {
              --app-width: 100svh;
              --app-height: 100svw;
              position: fixed;
              top: 0;
              left: 0;
              width: var(--app-width);
              height: var(--app-height);
              min-height: 0;
              overflow: hidden;
              transform: rotate(90deg) translateY(-100%);
              transform-origin: top left;
            }
          }
        `}</style>
      </head>

      <body style={{ margin: 0, overflowX: "hidden", background: "#00552e" }}>
        <div className="app-orientation-shell">
          <Outlet />
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
