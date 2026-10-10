import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Sans_Arabic, Inter, Playfair_Display } from "next/font/google";

import "./globals.css";

/**
 * The app's second-edition faces.
 *
 * Playfair Display for names, titles and section headings; Inter for
 * everything read or pressed; IBM Plex Sans Arabic for Arabic. The same three
 * the app loads from `@expo-google-fonts`, so an order code, a shop name and a
 * total look the same on the operator's screen as on the customer's phone.
 *
 * The app registers one **family per weight**, since React Native cannot
 * synthesise a weight on a custom family. That constraint does not exist here,
 * so each face is loaded once and `font-weight` does what it says. Playfair is
 * 600 only, as in the app, where every display weight maps to it.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["600"],
  display: "swap",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lebrunji",
  description: "Operations for Lebrunji.",
  icons: { icon: { url: "/favicon.svg", type: "image/svg+xml" } },
  // Nothing here is for the public, and a staff login page in a search index is
  // an invitation rather than a feature.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} ${plexArabic.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
