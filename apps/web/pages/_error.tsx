import { NextPageContext } from 'next';

/**
 * Custom Pages Router error page.
 * Required because the default Next.js _error page uses next/head which calls
 * useContext(HeadManagerContext) — but in an App Router-only project, the Pages
 * Router context providers aren't set up, causing prerender failures.
 *
 * The App Router error.tsx and not-found.tsx handle actual error rendering.
 * This page only exists to satisfy the Pages Router static prerender step.
 */
function ErrorPage({ statusCode }: { statusCode: number }) {
  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        height: '100vh',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <h1 style={{ fontSize: 48, fontWeight: 700, margin: '0 0 8px' }}>
        {statusCode}
      </h1>
      <p style={{ fontSize: 16, color: '#666', margin: 0 }}>
        {statusCode === 404
          ? 'This page could not be found.'
          : 'An unexpected error occurred.'}
      </p>
    </div>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? (err as any).statusCode : 404;
  return { statusCode };
};

export default ErrorPage;
