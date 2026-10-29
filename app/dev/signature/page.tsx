import { notFound } from 'next/navigation';
import { SignaturePad } from './signature-pad';

export const metadata = { title: 'Signature pad', robots: { index: false } };

// Dev-only tool for capturing the signature with real stroke movement.
export default function SignaturePadPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <SignaturePad />;
}
