"use client";

import React from "react";
import Link from "next/link";

export const Header = () => {
  return (
    <header>
      <nav className="fixed z-20 w-full">
        <div className="mx-auto max-w-6xl px-6">
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
