import React from "react";
import { Metadata } from "next";
import { Inter as FontSans, Lato, Nunito } from "next/font/google";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";

import "@/styles.css";
import { TailwindIndicator } from "@/components/ui/breakpoint-indicator";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
});

const lato = Lato({
  subsets: ["latin"],
  variable: "--font-lato",
  weight: "400",
});

const lucidaBlackletter = localFont({
  src: "../public/fonts/LucidaBlackletter.ttf",
  variable: "--font-lucida-bl",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://iwrl.net';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'I. William R. L',
    template: '%s — I. William R. L',
  },
  description: 'Software engineering, culture, and craft. Essays on building software, thinking clearly, and the world around it.',
  openGraph: {
    type: 'website',
    siteName: 'I. William R. L',
    title: 'I. William R. L',
    description: 'Software engineering, culture, and craft. Essays on building software, thinking clearly, and the world around it.',
    images: [{ url: '/images/hero-portrait.png', width: 1200, height: 630, alt: 'I. William R. L' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'I. William R. L',
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
    <html lang="en" className={cn(fontSans.variable, nunito.variable, lato.variable, lucidaBlackletter.variable)}>
      <body className="min-h-screen bg-background font-body antialiased">
        {children}
        <TailwindIndicator />
      </body>
    </html>
  );
}
