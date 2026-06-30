"use client";

import React from "react";
import Link from "next/link";

export const Header = () => {
  return (
    <header>
      <nav className="fixed z-20 w-full">
        {/* Left fade behind the logo. Matches the #0a0a0a page background, so on
            wide screens (logo over the empty left margin) it's invisible; on
            narrow screens, where the scrolling article passes under the logo, it
            shields the text and fades out to the right. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-0 w-[min(360px,52vw)]"
          style={{
            background: 'linear-gradient(to right, #0a0a0a 0%, #0a0a0a 38%, rgba(10,10,10,0) 100%)',
          }}
        />
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <div className="flex items-center py-5">
            <Link
              href="/"
              aria-label="home"
              className="font-heading text-2xl uppercase tracking-widest text-white transition-opacity hover:opacity-70"
            >
              IWRL
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
};
