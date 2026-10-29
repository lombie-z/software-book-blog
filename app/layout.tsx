import React from "react";
import { Metadata } from "next";
import { Caveat, Instrument_Sans, Newsreader } from "next/font/google";
import { cn, SITE_URL } from "@/lib/utils";

import "@/styles.css";
import { TailwindIndicator } from "@/components/ui/breakpoint-indicator";

const fontSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  style: ["normal", "italic"],
  axes: ["opsz"],
});

// Handwritten captions on the concept frames.
const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: '/' },
  title: {
    default: 'I. William R. L.',
    template: '%s — I. William R. L.',
  },
  description: 'Software engineering, culture, and craft. Essays on building software, thinking clearly, and the world around it.',
  openGraph: {
    type: 'website',
    siteName: 'I. William R. L.',
    title: 'I. William R. L.',
    description: 'Software engineering, culture, and craft. Essays on building software, thinking clearly, and the world around it.',
    images: [{ url: '/images/hero-portrait.png', width: 1200, height: 630, alt: 'I. William R. L.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'I. William R. L.',
    description: 'Software engineering, culture, and craft. Essays on building software, thinking clearly, and the world around it.',
    images: ['/images/hero-portrait.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn(fontSans.variable, newsreader.variable, caveat.variable)}>
      <body className="min-h-screen bg-background font-body text-foreground antialiased">
        {children}
        <TailwindIndicator />
      </body>
    </html>
  );
}
