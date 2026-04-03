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

export const metadata: Metadata = {
  title: "Tina",
  description: "Tina Cloud Starter",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={cn(fontSans.variable, nunito.variable, lato.variable, lucidaBlackletter.variable)}>
      <body suppressHydrationWarning className="min-h-screen bg-background font-body antialiased">
        {children}
        <TailwindIndicator />
      </body>
    </html>
  );
}
