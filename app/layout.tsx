import type { Metadata } from "next";
import { Mukta } from "next/font/google";
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
        {children}
      </body>
    </html>
  );
}
