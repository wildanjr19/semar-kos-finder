import './globals.css';
import { ReactNode } from 'react';
import { cookies } from 'next/headers';
import BackgroundTaskIndicator from '@/components/BackgroundTaskIndicator';

export const metadata = {
  title: 'Admin Panel',
  description: 'Admin panel for Kos Finder',
};

function Nav() {
  return (
    <nav style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0.75rem 2rem',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: '1.5rem',
      }}>
        <a href="/" style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.25rem',
          color: 'var(--text-primary)',
          textDecoration: 'none',
          fontWeight: 400,
        }}>
          UNSKosFinder
        </a>
        <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />
        <a href="/kos" style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          textDecoration: 'none',
          fontWeight: 500,
          padding: '0.375rem 0',
          borderBottom: '2px solid transparent',
          transition: 'all 0.2s ease',
        }}>Kos</a>
        <a href="/master-uns" style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          textDecoration: 'none',
          fontWeight: 500,
          padding: '0.375rem 0',
          borderBottom: '2px solid transparent',
          transition: 'all 0.2s ease',
        }}>Master UNS</a>
        <a href="/actions/parse" style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          textDecoration: 'none',
          fontWeight: 500,
          padding: '0.375rem 0',
          borderBottom: '2px solid transparent',
          transition: 'all 0.2s ease',
        }}>🧹 Clean Data</a>
        <a href="/actions/parse/jobs" style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          textDecoration: 'none',
          fontWeight: 500,
          padding: '0.375rem 0',
          borderBottom: '2px solid transparent',
          transition: 'all 0.2s ease',
        }}>Parse Jobs</a>
        <a href="/prototype" style={{
          fontSize: '0.875rem',
          color: 'var(--accent)',
          textDecoration: 'none',
          fontWeight: 600,
          padding: '0.375rem 0',
          borderBottom: '2px solid transparent',
          transition: 'all 0.2s ease',
        }}>Ops Console</a>
      </div>
    </nav>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const theme = cookies().get('semar-ops-theme')?.value === 'dark' ? 'dark' : 'light';

  return (
    <html lang="id" data-semar-ops-theme={theme} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Serif+Display:ital@0;1&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: "(function(){try{var html=document.documentElement;var theme=localStorage.getItem('semar-ops-theme');if(theme!=='dark'&&theme!=='light'){var m=document.cookie.match(/(?:^|; )semar-ops-theme=([^;]+)/);theme=m?decodeURIComponent(m[1]):null;}if(theme==='dark'||theme==='light'){html.setAttribute('data-semar-ops-theme',theme);}}catch(_){}})();",
          }}
        />
      </head>
      <body>
        <Nav />
        {children}
        <BackgroundTaskIndicator />
      </body>
    </html>
  );
}
