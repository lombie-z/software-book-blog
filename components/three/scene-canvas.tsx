'use client';

import { useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { SoftShadows, View } from '@react-three/drei';
import { eyeFor, SUN_DIRECTION } from './niche-params';
import { sceneState } from './scene-state';

function SunController() {
  useEffect(() => {
    sceneState.sunDirection.set(...SUN_DIRECTION);
  }, []);

  useFrame(() => {
    Object.assign(sceneState.eye, eyeFor(window.innerWidth, window.innerHeight));
  }, -1);
  return null;
}

/**
 * The canvas only draws when something changes. Scrolling and resizing move the 3D boxes, and so can layout shifts
 * (fonts loading, sections expanding), so those ask for a redraw. Animated scenes ask for their own frames while they're
 * on screen. Two frames each time, because drei's View skips one as a box comes back on screen.
 */
function RedrawOnChange() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const redraw = () => invalidate(2);
    window.addEventListener('scroll', redraw, { passive: true });
    window.addEventListener('resize', redraw);
    const layout = new ResizeObserver(redraw);
    layout.observe(document.body);
    document.fonts?.ready.then(redraw);
    return () => {
      window.removeEventListener('scroll', redraw);
      window.removeEventListener('resize', redraw);
      layout.disconnect();
    };
  }, [invalidate]);
  return null;
}

export default function SceneCanvas() {
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      sceneState.reducedMotion = query.matches;
    };
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return (
    <Canvas
      eventSource={document.body}
      frameloop="demand"
      shadows
      flat
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}
    >
      <SunController />
      <RedrawOnChange />
      <SoftShadows size={42} samples={24} focus={0.35} />
      <View.Port />
    </Canvas>
  );
}
