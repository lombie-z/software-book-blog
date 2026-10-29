'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { ContactShadows, OrthographicCamera, useGLTF, View } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { type Group, type Mesh, type Object3D, type OrthographicCamera as OrthographicCameraImpl, Vector3 } from 'three';
import { DRACO_PATH } from './cactus';
import { SilhouetteOutline } from './silhouette-outline';
import { useStudioReflections } from './studio-environment';

const URL = '/models/micro-biome.glb';
// Matches the Blender preview camera (art/micro-biome.blend): orthographic, three-quarter, 3.9 units across.
const TARGET = new Vector3(0, 0.92, 0);
const CAMERA_POSITION = TARGET.clone().add(new Vector3(-1, 0.75, 1).normalize().multiplyScalar(8));
const FRAME = 3.7;
// The letter ring orbits this point; the sticker band sits at its depth so the ring weaves in front of and behind it.
const OUTLINE_DEPTH = new Vector3(0, 0.62, 0);
const MAX_YAW = Math.PI / 3;
const MAX_PITCH = Math.PI / 14;

export interface DragState {
  /** Target yaw/pitch from the pointer, in radians; 0 when released. */
  yaw: number;
  pitch: number;
  active: boolean;
}

type Animated = { node: Object3D; kind: 'ring' | 'cloud' | 'star' | 'letter' | 'water'; i: number; base: { position: Vector3; scale: Vector3; rotY: number } };

function classify(name: string): Animated['kind'] | null {
  if (name === 'LetterRing') return 'ring';
  if (name === 'LetterRingTilt') return null;
  if (name.startsWith('Cloud')) return 'cloud';
  if (name.startsWith('Star')) return 'star';
  if (name.startsWith('Letter') || name.startsWith('Word')) return 'letter';
  if (name.startsWith('Water')) return 'water';
  return null;
}

// The lettering tumbles free of the sticker outline; contact shadows aren't part of the object.
function isOutsideOutline(o: Object3D) {
  return o.name.startsWith('Letter') || o.name.startsWith('Word') || o.name === 'ContactShadows';
}

export function MicroBiomeScene({ trackRef, drag, onReady, animate }: { trackRef: React.RefObject<HTMLDivElement | null>; drag: React.RefObject<DragState>; onReady: () => void; animate: boolean }) {
  const { scene } = useGLTF(URL, DRACO_PATH);
  const pivot = useRef<Group>(null);
  const camera = useRef<OrthographicCameraImpl>(null);
  const rotation = useRef({ yaw: 0, pitch: 0, vYaw: 0, vPitch: 0 });

  const animated = useMemo(() => {
    const list: Animated[] = [];
    const counts: Record<string, number> = {};
    scene.traverse((child) => {
      if ((child as Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
      const kind = classify(child.name);
      // Only animate the named object nodes, not glTF's per-primitive children.
      if (kind && child.parent && !classify(child.parent.name)) {
        counts[kind] = (counts[kind] ?? 0) + 1;
        list.push({ node: child, kind, i: counts[kind], base: { position: child.position.clone(), scale: child.scale.clone(), rotY: child.rotation.y } });
      }
    });
    return list;
  }, [scene]);

  useStudioReflections(scene, 0.8);
  useEffect(onReady, [onReady]);

  useFrame((state, delta) => {
    const el = trackRef.current;
    const cam = camera.current;
    if (el && cam) {
      cam.zoom = el.clientWidth / FRAME;
      cam.updateProjectionMatrix();
    }

    // Critically-damped spring toward the drag target (or home when released).
    const r = rotation.current;
    const d = drag.current;
    const k = 60;
    const c = 2 * Math.sqrt(k);
    const dt = Math.min(delta, 1 / 30);
    const tYaw = Math.max(-MAX_YAW, Math.min(MAX_YAW, d?.yaw ?? 0));
    const tPitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, d?.pitch ?? 0));
    r.vYaw += (k * (tYaw - r.yaw) - c * r.vYaw) * dt;
    r.vPitch += (k * (tPitch - r.pitch) - c * r.vPitch) * dt;
    r.yaw += r.vYaw * dt;
    r.pitch += r.vPitch * dt;

    // The canvas draws on demand, so keep the frames coming while the stage is on screen and anything is moving.
    const rect = el?.getBoundingClientRect();
    const onScreen = !!rect && rect.bottom > 0 && rect.top < window.innerHeight;
    const settling = Math.abs(r.vYaw) + Math.abs(r.vPitch) + Math.abs(tYaw - r.yaw) + Math.abs(tPitch - r.pitch) > 1e-4;
    if (onScreen && (animate || d?.active || settling)) state.invalidate();

    if (pivot.current) {
      const t = state.clock.elapsedTime;
      const idle = animate && !d?.active ? Math.sin(t * 0.35) * 0.12 : 0;
      pivot.current.rotation.set(r.pitch, r.yaw + idle, 0);
    }

    if (!animate) return;
    const t = state.clock.elapsedTime;
    for (const a of animated) {
      const { node, base, i } = a;
      switch (a.kind) {
        case 'ring':
          // MICRO • BIOME orbits slowly around the planter.
          node.rotation.y = base.rotY + t * 0.18;
          break;
        case 'cloud':
          node.position.x = base.position.x + Math.sin(t * 0.35 + i * 2.1) * 0.12;
          node.position.z = base.position.z + Math.cos(t * 0.25 + i) * 0.05;
          break;
        case 'star': {
          const s = 1 + Math.sin(t * 2.2 + i * 1.9) * 0.18;
          node.scale.copy(base.scale).multiplyScalar(s);
          node.rotation.y = base.rotY + Math.sin(t * 0.8 + i) * 0.4;
          break;
        }
        case 'letter':
          node.position.y = base.position.y + Math.sin(t * 1.6 - i * 0.7) * 0.035;
          break;
        case 'water':
          // It fills the planter wall to wall, so it can't swell; it rises and falls a hair instead.
          node.position.y = base.position.y + Math.sin(t * 0.9) * 0.004;
          break;
      }
    }
  });

  return (
    <>
      <OrthographicCamera ref={camera} makeDefault position={CAMERA_POSITION.toArray()} near={0.1} far={40} onUpdate={(c) => c.lookAt(TARGET)} />
      <hemisphereLight args={['#fffaf2', '#e3d6c6', 0.9]} />
      <directionalLight
        position={[-3, 6, 4]}
        intensity={1.8}
        color="#fff6ea"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
        shadow-camera-left={-2.5}
        shadow-camera-right={2.5}
        shadow-camera-top={3}
        shadow-camera-bottom={-1.5}
      />
      <group position={[0, 0, 0]}>
        <group ref={pivot}>
          <primitive object={scene} />
        </group>
        <SilhouetteOutline target={scene} exclude={isOutsideOutline} depthAt={OUTLINE_DEPTH} />
        <ContactShadows name="ContactShadows" position={[0, -0.01, 0]} scale={3} blur={2.4} opacity={0.32} far={0.35} resolution={512} color="#6b5a48" />
      </group>
    </>
  );
}

type MicroBiomeSceneProps = Parameters<typeof MicroBiomeScene>[0];

/** The biome's drei View: lives in this module so three.js only loads with it (see blocks/micro-biome.tsx). */
export function MicroBiomeView(props: MicroBiomeSceneProps) {
  return (
    <View className="absolute inset-0">
      <Suspense fallback={null}>
        <MicroBiomeScene {...props} />
      </Suspense>
    </View>
  );
}
