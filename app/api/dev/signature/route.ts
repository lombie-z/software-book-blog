import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

// Dev-only: stores signature takes drawn at /dev/signature as JSON in art/signature/ for processing.
const DIR = path.join(process.cwd(), 'art', 'signature');
const devOnly = () => (process.env.NODE_ENV === 'development' ? null : NextResponse.json({ error: 'not found' }, { status: 404 }));

export async function GET() {
  const blocked = devOnly();
  if (blocked) return blocked;
  await fs.mkdir(DIR, { recursive: true });
  const files = (await fs.readdir(DIR)).filter((f) => f.endsWith('.json')).sort().reverse();
  return NextResponse.json({ takes: files });
}

export async function POST(request: NextRequest) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const take = await request.json();
  if (!Array.isArray(take?.strokes) || take.strokes.length === 0) {
    return NextResponse.json({ error: 'no strokes' }, { status: 400 });
  }
  await fs.mkdir(DIR, { recursive: true });
  const name = `take-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  await fs.writeFile(path.join(DIR, name), JSON.stringify(take));
  return NextResponse.json({ saved: `art/signature/${name}` });
}
