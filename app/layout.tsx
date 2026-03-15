//app/layout.tsx

import type { Metadata } from "next";
import { Mukta } from "next/font/google";
import "./garden.css";
import "./globals.css";


const mukta = Mukta({
  variable: "--font-mukta",
  weight: ['400', '500', '600', '700'], 
  subsets: ["latin"],
});


export const metadata = {
  title: 'It Depends',
  description: 'Interactive statistics for exploring uncertainty',
  keywords: ['stats', 'statistics', 'sample', 'sampling', 'data', 'population', 'fireflies', 'interactive','learning', 'random'],
  author: 'Nera Blagdan',
  robots: 'index, follow', // for search engines
  openGraph: {
    title: 'It Depends',
    description: 'Interactive statistics for exploring uncertainty',
    url: 'https://statsapp-vdcv.vercel.app/',
    siteName: 'It Depends',
    images: ['/og-image.png'], // optional
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'It Depends',
    description: 'Interactive statistics for exploring uncertainty',
    creator: '@nera', // optional
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.ico',
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${mukta.variable} antialiased`}
      >
        <nav style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
          padding: '0 2.5rem 0 1.5rem', height: 54,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(10,10,8,0.92)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <a href="/" style={{
            fontFamily: 'var(--kanit)', fontWeight: 600, fontSize: '0.95rem',
            letterSpacing: '0.04em', color: '#f0efe8', textDecoration: 'none',
          }}>
            it<b style={{ color: '#c9a000' }}>.</b>depends
          </a>
          <a href="https://lineanera.hr" style={{
            fontFamily: 'var(--kanit)', fontSize: '0.72rem', fontWeight: 400,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: '#6a6a64', textDecoration: 'none',
          }}>
            ↗ lineanera.hr
          </a>
        </nav>
        
        {children}

      </body>
    </html>
  );
}
