'use client';

import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { SoftShadows } from '@react-three/drei';
import { eyeFor, SUN_DIRECTION, viewportSize } from './niche-params';
import { sceneState } from './scene-state';

/** Where the self-hosted Draco decoder lives, for loading the glTF models. */
export const DRACO_PATH = '/draco/';

function SunController() {
  useEffect(() => {
    sceneState.sunDirection.set(...SUN_DIRECTION);
  }, []);

  useFrame(() => {
    const { width, height } = viewportSize();
    Object.assign(sceneState.eye, eyeFor(width, height));
  }, -1);
  return null;
}

/**
 * The canvas only draws when something changes, and only while its box is near the screen. Scrolling and resizing
 * shift the perspective, and so can layout shifts (fonts loading, sections expanding). Waking up counts too: coming
 * back to the tab or the page, or the GPU restoring a lost context (e.g. after sleep). Once the page starts moving it
 * redraws every frame until it settles, since phones can send fewer scroll events than frames during a fling.
 * Animated scenes ask for their own frames while they're on screen. A scene whose view doesn't depend on the scroll
 * position opts out with `followScroll={false}`.
 */
function RedrawOnChange({ followScroll }: { followScroll: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  const canvas = useThree((s) => s.gl.domElement);
  useEffect(() => {
    let near = false;
    const redraw = () => near && invalidate();
    let lastY = window.scrollY;
    let still = 0;
    let following = false;
    const follow = () => {
      redraw();
      if (window.scrollY === lastY) still++;
      else {
        still = 0;
        lastY = window.scrollY;
      }
      if (still < 8) requestAnimationFrame(follow);
      else following = false;
    };
    const onScroll = () => {
      redraw();
      if (following) return;
      following = true;
      still = 0;
      requestAnimationFrame(follow);
    };
    const onVisible = () => document.visibilityState === 'visible' && redraw();
    const visibility = new IntersectionObserver(
      ([entry]) => {
        near = entry.isIntersecting;
        redraw();
      },
      { rootMargin: '50% 0px' }
    );
    visibility.observe(canvas);
    if (followScroll) window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', redraw);
    window.addEventListener('pageshow', redraw);
    document.addEventListener('visibilitychange', onVisible);
    canvas.addEventListener('webglcontextrestored', redraw);
    const layout = new ResizeObserver(redraw);
    layout.observe(document.body);
    document.fonts?.ready.then(redraw);
    return () => {
      visibility.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', redraw);
      window.removeEventListener('pageshow', redraw);
      document.removeEventListener('visibilitychange', onVisible);
      canvas.removeEventListener('webglcontextrestored', redraw);
      layout.disconnect();
    };
  }, [invalidate, canvas, followScroll]);
  return null;
}

// drei's SoftShadows patches three's shared shadow shader chunk, so only one canvas may mount it; the others compile
// against the same patched chunk. Every canvas uses the basic shadow map that the patch expects.
let softShadowsOwner: object | null = null;
function SharedSoftShadows() {
  const [owner] = useState(() => {
    if (softShadowsOwner) return null;
    softShadowsOwner = {};
    return softShadowsOwner;
  });
  useEffect(
    () => () => {
      if (owner && softShadowsOwner === owner) softShadowsOwner = null;
    },
    [owner]
  );
  return owner ? <SoftShadows size={42} samples={24} focus={0.35} /> : null;
}

const CompiledContext = createContext<() => void>(() => {});

/**
 * Goes last inside a scene's Suspense boundary. The canvas holds off drawing until every material in the scene has
 * compiled in the background (KHR_parallel_shader_compile). Drawing straight away makes three.js wait on each shader
 * in turn, which froze the page for a second or two whenever the browser's shader cache was cold. Without the
 * extension three.js waits a moment and compiles as before.
 */
export function CompileFirst() {
  const get = useThree((s) => s.get);
  const frameloop = useThree((s) => s.frameloop);
  const invalidate = useThree((s) => s.invalidate);
  const compiled = useContext(CompiledContext);
  useEffect(() => {
    let gone = false;
    const { gl, scene, camera } = get();
    gl.compileAsync(scene, camera).then(() => {
      if (!gone) compiled();
    });
    return () => {
      gone = true;
    };
  }, [get, compiled]);
  // Draw the first frame once the canvas is let go.
  useEffect(() => {
    if (frameloop !== 'never') invalidate();
  }, [frameloop, invalidate]);
  return null;
}

/**
 * A WebGL canvas that fills its box. Each 3D element (a niche, the micro-biome) gets its own, sitting in the page
 * with its box, so scrolling moves it with the box on every platform. A single fixed canvas drawing into every box
 * trails the page on phones, which scroll on their own thread while JavaScript catches up a frame or more later.
 * It draws nothing until the scene's <CompileFirst /> reports its shaders ready.
 */
export function SceneCanvas({ children, followScroll = true }: { children: ReactNode; followScroll?: boolean }) {
  const [compiled, setCompiled] = useState(false);
  const markCompiled = useCallback(() => setCompiled(true), []);
  return (
    <div className='pointer-events-none absolute inset-0'>
      <Canvas
        frameloop={compiled ? 'demand' : 'never'}
        shadows='basic'
        flat
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
        // Its size never changes on scroll, so don't re-measure on every scroll.
        resize={{ scroll: false }}
        onCreated={({ gl }) => {
          // three.js reads back every shader's log to report errors, and each read stalls the page while the GPU is
          // busy compiling. Development keeps the checks.
          if (process.env.NODE_ENV === 'production') gl.debug.checkShaderErrors = false;
        }}
      >
        <SunController />
        <RedrawOnChange followScroll={followScroll} />
        <SharedSoftShadows />
        <CompiledContext.Provider value={markCompiled}>{children}</CompiledContext.Provider>
      </Canvas>
    </div>
  );
}
