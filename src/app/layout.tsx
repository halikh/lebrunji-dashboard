import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Barlow, Barlow_Condensed, Cairo } from 'next/font/google';

import './globals.css';

/**
 * The app's three faces.
 *
 * Barlow for body, Barlow Condensed for headings — the design's pair, chosen
 * because their proportions already agree, so the contrast reads as emphasis
 * rather than as two typefaces sharing a screen. Cairo for Arabic, because
 * neither Barlow has Arabic coverage and a designed Latin face beside a
 * fallback Arabic one looks broken rather than bilingual.
 *
 * The app registers one **family per weight**, since React Native cannot
 * synthesise a weight on a custom family. That constraint does not exist here,
 * so each face is loaded once with the weights it needs and `font-weight` does
 * what it says.
 */
const barlow = Barlow({
  variable: '--font-barlow',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const barlowCondensed = Barlow_Condensed({
  variable: '--font-barlow-condensed',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
});

const cairo = Cairo({
  variable: '--font-cairo',
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Lebrunji',
  description: 'Operations for Lebrunji.',
  // Nothing here is for the public, and a staff login page in a search index is
  // an invitation rather than a feature.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${barlow.variable} ${barlowCondensed.variable} ${cairo.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
