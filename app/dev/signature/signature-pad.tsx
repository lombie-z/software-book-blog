'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// [x, y, ms since the take started, pressure]
type Point = [number, number, number, number];
type Stroke = Point[];

const WIDTH = 960;
const HEIGHT = 540;
const INK = '#2f2a27';

function drawStroke(ctx: CanvasRenderingContext2D, points: Point[]) {
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  if (points.length === 1) {
    ctx.lineTo(points[0][0] + 0.1, points[0][1]);
  }
  // Quadratic curves through midpoints: smooth on screen, while the raw points are what gets saved.
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last[0], last[1]);
  ctx.stroke();
}

export function SignaturePad() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const startTime = useRef<number | null>(null);
  const pointer = useRef<{ x: number; y: number; inside: boolean }>({ x: 0, y: 0, inside: false });
  const replaying = useRef(false);
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState('');
  const [takes, setTakes] = useState<string[]>([]);

  const redraw = useCallback((list: Stroke[] = strokes.current) => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    // Baseline guide.
    ctx.save();
    ctx.strokeStyle = 'rgba(47,42,39,0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(40, HEIGHT * 0.66);
    ctx.lineTo(WIDTH - 40, HEIGHT * 0.66);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of list) drawStroke(ctx, s);
    if (current.current && list === strokes.current) drawStroke(ctx, current.current);
  }, []);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = WIDTH * dpr;
    el.height = HEIGHT * dpr;
    el.getContext('2d')?.scale(dpr, dpr);
    redraw();
    fetch('/api/dev/signature')
      .then((r) => r.json())
      .then((d) => setTakes(d.takes ?? []))
      .catch(() => {});
  }, [redraw]);

  const now = () => {
    if (startTime.current === null) startTime.current = performance.now();
    return Math.round(performance.now() - startTime.current);
  };

  const toLocal = (e: PointerEvent | React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * WIDTH, y: ((e.clientY - r.top) / r.height) * HEIGHT };
  };

  const begin = (x: number, y: number, pressure = 0.5) => {
    if (replaying.current) return;
    current.current = [[x, y, now(), pressure]];
    redraw();
  };
  const extend = (x: number, y: number, pressure = 0.5) => {
    if (!current.current) return;
    current.current.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10, now(), Math.round(pressure * 100) / 100]);
    redraw();
  };
  const end = () => {
    if (!current.current) return;
    strokes.current.push(current.current);
    current.current = null;
    setCount(strokes.current.length);
    redraw();
  };

  // Click-and-drag draws; so does moving the cursor while holding Shift (easier on a trackpad).
  const onPointerDown = (e: React.PointerEvent) => {
    canvas.current?.setPointerCapture(e.pointerId);
    const { x, y } = toLocal(e);
    begin(x, y, e.pressure || 0.5);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const events = 'getCoalescedEvents' in e.nativeEvent ? e.nativeEvent.getCoalescedEvents() : [];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const { x, y } = toLocal(ev);
      pointer.current = { x, y, inside: true };
      if (current.current) extend(x, y, ev.pressure || 0.5);
    }
  };

  const undo = useCallback(() => {
    strokes.current.pop();
    setCount(strokes.current.length);
    redraw();
  }, [redraw]);

  const clear = () => {
    strokes.current = [];
    current.current = null;
    startTime.current = null;
    setCount(0);
    setStatus('');
    redraw();
  };

  // Plays the take back at the speed it was drawn.
  const replay = () => {
    if (replaying.current || strokes.current.length === 0) return;
    replaying.current = true;
    const all = strokes.current;
    const t0 = performance.now();
    const total = all[all.length - 1].at(-1)![2];
    const tick = () => {
      const t = performance.now() - t0 + all[0][0][2];
      redraw(all.map((s) => s.filter((p) => p[2] <= t)).filter((s) => s.length));
      if (t < total + 200) requestAnimationFrame(tick);
      else {
        replaying.current = false;
        redraw();
      }
    };
    requestAnimationFrame(tick);
  };

  const save = async () => {
    if (strokes.current.length === 0) return;
    setStatus('Saving…');
    const res = await fetch('/api/dev/signature', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ width: WIDTH, height: HEIGHT, createdAt: new Date().toISOString(), strokes: strokes.current }),
    });
    const data = await res.json();
    setStatus(data.saved ? `Saved ${data.saved}` : `Failed: ${data.error}`);
    if (data.saved) setTakes((t) => [data.saved.split('/').pop(), ...t]);
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if (e.key === 'Shift' && !e.repeat && pointer.current.inside && !current.current) {
        begin(pointer.current.x, pointer.current.y);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') end();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="font-serif text-4xl text-ink">Signature pad</h1>
      <p className="mt-3 max-w-[65ch] text-muted-foreground">
        Sign as you normally would, in your usual stroke order. Click and drag to draw, or <strong className="text-ink">hold Shift and move</strong> the cursor
        (easier on a trackpad); lift to end a stroke. Every point is saved with its timing, so the site can replay it the way you wrote it. Size and
        position don't matter. <kbd>⌘Z</kbd> undoes the last stroke.
      </p>

      <canvas
        ref={canvas}
        className="mt-8 aspect-[16/9] w-full touch-none cursor-crosshair rounded-sm bg-white shadow-[inset_0_0_0_1px_var(--rule)]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={() => {
          pointer.current.inside = false;
        }}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <button type="button" onClick={undo} className="rounded-sm border border-rule px-3 py-1.5 hover:bg-plaster-shade">
          Undo
        </button>
        <button type="button" onClick={clear} className="rounded-sm border border-rule px-3 py-1.5 hover:bg-plaster-shade">
          Clear
        </button>
        <button type="button" onClick={replay} className="rounded-sm border border-rule px-3 py-1.5 hover:bg-plaster-shade">
          Replay
        </button>
        <button type="button" onClick={save} disabled={count === 0} className="rounded-sm bg-ink px-4 py-1.5 text-plaster disabled:opacity-40">
          Save take
        </button>
        <span className="text-muted-foreground">
          {count} stroke{count === 1 ? '' : 's'} {status && `· ${status}`}
        </span>
      </div>

      {takes.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Saved takes (art/signature/)</h2>
          <ul className="mt-2 space-y-1 font-mono text-sm text-ink">
            {takes.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
