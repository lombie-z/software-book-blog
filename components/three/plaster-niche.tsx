'use client';

import { type ReactNode, Suspense, useMemo, useRef } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  Color,
  type DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  type Group,
  LinearSRGBColorSpace,
  type Mesh,
  MeshLambertMaterial,
  type PerspectiveCamera as PerspectiveCameraImpl,
  Quaternion,
  Vector3,
} from 'three';
import { cn } from '@/lib/utils';
import { Cactus } from './cactus';
import { SceneCanvas } from './scene-canvas';
import { GROUND_FACTOR, NICHE_DEPTH, PLASTER_HEX, SKY, SKY_RGB, SUN, SUN_RGB } from './niche-params';
import { sceneState } from './scene-state';

// CSS pixels → world units.
const PX = 0.01;
const PLASTER = new Color(PLASTER_HEX);
const SKY_COLOR = new Color().setRGB(...SKY_RGB, LinearSRGBColorSpace);
const GROUND_COLOR = SKY_COLOR.clone().multiplyScalar(GROUND_FACTOR);
const SUN_COLOR = new Color().setRGB(...SUN_RGB, LinearSRGBColorSpace);

const X_AXIS = new Vector3(1, 0, 0);
const Z_AXIS = new Vector3(0, 0, 1);
const tilt = new Quaternion();

interface PlasterNicheProps {
  className?: string;
  /** Recess depth as a fraction of the opening's shorter side. */
  depth?: number;
  /** How far the ceiling drops at the left edge, as a fraction of the height (0 = rectangular opening). */
  slope?: number;
  /** Puts the clay cactus at the back left of the floor, as in the sketch. */
  cactus?: boolean;
  /** Called once the room (and its cactus) has drawn, so the CSS stand-in can fade out. */
  onReady?: () => void;
  /** Rendered on the niche floor, in units of the niche's height (1 = full height), origin at floor centre. */
  children?: ReactNode;
}

export function PlasterNiche({ className, depth = NICHE_DEPTH, slope = 0, cactus, onReady, children }: PlasterNicheProps) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className={cn('absolute inset-0', className)}>
      <SceneCanvas>
        {/* One boundary for the whole room, so it only appears once the cactus model is in too. */}
        <Suspense fallback={null}>
          <NicheScene trackRef={ref} depth={depth} slope={slope} onReady={onReady}>
            {cactus && <Cactus position={[-0.5, 0, -0.16]} rotation-y={0.5} />}
            {children}
          </NicheScene>
        </Suspense>
      </SceneCanvas>
    </div>
  );
}

function NicheScene({
  trackRef,
  depth,
  slope,
  onReady,
  children,
}: { trackRef: React.RefObject<HTMLDivElement | null>; depth: number; slope: number; onReady?: () => void; children?: ReactNode }) {
  const reported = useRef(false);
  const camera = useRef<PerspectiveCameraImpl>(null);
  const back = useRef<Mesh>(null);
  const top = useRef<Mesh>(null);
  const bottom = useRef<Mesh>(null);
  const left = useRef<Mesh>(null);
  const right = useRef<Mesh>(null);
  const frame = useRef<Group>(null);
  const floor = useRef<Group>(null);
  const sun = useRef<DirectionalLight>(null);
  const material = useMemo(() => new MeshLambertMaterial({ color: PLASTER }), []);
  // Wall face above a sloped ceiling, in the frame group's unit space (opening = 1 × 1 centred on 0).
  const corner = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute([-0.5, 0.5 - slope, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.computeVertexNormals();
    return g;
  }, [slope]);
  // Smaller shadow maps on phones; the niches are smaller there anyway.
  const shadowSize = useMemo(() => (window.innerWidth < 768 ? 1024 : 2048), []);

  // Runs before R3F draws the frame: fit the room to the DOM box and aim an off-axis camera through it.
  useFrame(() => {
    const el = trackRef.current;
    const cam = camera.current;
    if (!el || !cam || !back.current || !top.current || !bottom.current || !left.current || !right.current || !frame.current || !floor.current || !sun.current) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const w = rect.width * PX;
    const h = rect.height * PX;
    const d = Math.min(w, h) * depth;
    const drop = h * slope;

    back.current.position.set(0, 0, -d);
    back.current.scale.set(w, h, 1);
    // Ceiling runs from the lowered top-left corner up to the top-right corner.
    top.current.position.set(0, h / 2 - drop / 2, -d / 2);
    top.current.quaternion.setFromAxisAngle(Z_AXIS, Math.atan2(drop, w)).multiply(tilt.setFromAxisAngle(X_AXIS, Math.PI / 2));
    top.current.scale.set(Math.hypot(w, drop), d, 1);
    bottom.current.position.set(0, -h / 2, -d / 2);
    bottom.current.scale.set(w, d, 1);
    left.current.position.set(-w / 2, -drop / 2, -d / 2);
    left.current.scale.set(d, h - drop, 1);
    right.current.position.set(w / 2, 0, -d / 2);
    right.current.scale.set(d, h, 1);
    frame.current.scale.set(w, h, 1);
    floor.current.position.set(0, -h / 2, -d / 2);
    floor.current.scale.setScalar(h);

    // Eye relative to the opening's centre, y up.
    const { eye } = sceneState;
    const ex = (eye.x - (rect.left + rect.width / 2)) * PX;
    const ey = -(eye.y - (rect.top + rect.height / 2)) * PX;
    const ez = eye.distance * PX;
    cam.position.set(ex, ey, ez);
    cam.rotation.set(0, 0, 0);
    // Keep drei's aspect check satisfied so it never rebuilds our off-axis projection.
    cam.aspect = rect.width / rect.height;
    const near = 0.05;
    const s = near / ez;
    cam.near = near;
    cam.far = ez + d + 50;
    cam.projectionMatrix.makePerspective((-w / 2 - ex) * s, (w / 2 - ex) * s, (h / 2 - ey) * s, (-h / 2 - ey) * s, near, cam.far);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

    // Tight shadow frustum around the room (and the lip of the opening) keeps edges crisp.
    const reach = Math.max(w, h) * 0.8;
    sun.current.position.copy(sceneState.sunDirection).multiplyScalar(reach * 2);
    sun.current.position.z -= d / 2;
    sun.current.target.position.set(0, 0, -d / 2);
    sun.current.target.updateMatrixWorld();
    const shadowCam = sun.current.shadow.camera;
    shadowCam.left = -reach;
    shadowCam.right = reach;
    shadowCam.top = reach;
    shadowCam.bottom = -reach;
    shadowCam.near = 0.01;
    shadowCam.far = reach * 4;
    shadowCam.updateProjectionMatrix();

    if (!reported.current) {
      reported.current = true;
      // This frame is drawn right after this callback; report on the next one so it's definitely on screen.
      requestAnimationFrame(() => onReady?.());
    }
  }, 0);

  return (
    <>
      <PerspectiveCamera ref={camera} makeDefault manual />
      {/* Ground slightly darker than sky so ceilings read a touch deeper than floors. */}
      <hemisphereLight args={[SKY_COLOR, GROUND_COLOR, SKY]} />
      <directionalLight
        ref={sun}
        color={SUN_COLOR}
        intensity={SUN}
        castShadow
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />

      <mesh ref={back} material={material} receiveShadow castShadow>
        <planeGeometry />
      </mesh>
      <mesh ref={top} material={material} receiveShadow castShadow>
        <planeGeometry />
      </mesh>
      <mesh ref={bottom} material={material} rotation-x={-Math.PI / 2} receiveShadow castShadow>
        <planeGeometry />
      </mesh>
      <mesh ref={left} material={material} rotation-y={Math.PI / 2} receiveShadow castShadow>
        <planeGeometry />
      </mesh>
      <mesh ref={right} material={material} rotation-y={-Math.PI / 2} receiveShadow castShadow>
        <planeGeometry />
      </mesh>

      {/* The wall face around the opening. Never drawn (the page is visible there), but it hides what's behind it and casts the lip shadow. */}
      <group ref={frame}>
        {slope > 0 && (
          <mesh geometry={corner} castShadow renderOrder={-1}>
            {/* Double-sided so it also lands in the shadow map, which renders back faces. */}
            <meshBasicMaterial colorWrite={false} side={DoubleSide} />
          </mesh>
        )}
        <mesh position={[0, 1.5, 0]} castShadow>
          <boxGeometry args={[4, 2, 0.001]} />
          <meshBasicMaterial colorWrite={false} />
        </mesh>
        <mesh position={[0, -1.5, 0]} castShadow>
          <boxGeometry args={[4, 2, 0.001]} />
          <meshBasicMaterial colorWrite={false} />
        </mesh>
        <mesh position={[-1.5, 0, 0]} castShadow>
          <boxGeometry args={[2, 1, 0.001]} />
          <meshBasicMaterial colorWrite={false} />
        </mesh>
        <mesh position={[1.5, 0, 0]} castShadow>
          <boxGeometry args={[2, 1, 0.001]} />
          <meshBasicMaterial colorWrite={false} />
        </mesh>
      </group>

      <group ref={floor}>{children}</group>
    </>
  );
}
