export function loader({ context }: { context: { cloudflare: { env: { APP_NAME?: string } } } }) {
  return { message: context.cloudflare.env.APP_NAME ?? "Mahjong Tool" };
}

export default function Home({ loaderData }: { loaderData: { message: string } }) {
  return (
    <main>
      <h1>{loaderData.message}</h1>
      <p>Cloudflare Workers + React Router テンプレート</p>
    </main>
  );
}
