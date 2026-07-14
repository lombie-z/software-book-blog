import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Single source for the canonical site origin (no trailing slash). Set
// NEXT_PUBLIC_SITE_URL in prod; the fallback is the production domain.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://iwrl.net').replace(/\/$/, '');
export const SITE_NAME = 'I. William R. L.';
export const SITE_DESCRIPTION = 'Software engineering, culture, and craft. Essays on building software, thinking clearly, and the world around it.';
