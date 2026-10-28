'use client';

import { type ReactNode, useMemo, useRef } from 'react';
import { PerspectiveCamera, View } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Color, LinearSRGBColorSpace, type DirectionalLight, type Group, type Mesh, MeshLambertMaterial, type PerspectiveCamera as PerspectiveCameraImpl } from 'three';
import { cn } from '@/lib/utils';
import { sceneState } from './scene-state';

// CSS pixels → world units.
const PX = 0.01;
// Same as --plaster in styles.css: the niche is the page itself, only shadow sets it apart.
const PLASTER = new Color('#f5f2ed');
// Lambert output = albedo * irradiance / π. Sun (×0.8, its fixed tilt toward the wall) plus sky light
// sum to π per channel on a sunlit back wall, so it renders exactly the page colour; shadow keeps only the sky (~64%).
// The sky is a little warm (bounce off the plaster) and the sun a little cool, so shadows stay warm
// while the sunlit sum is neutral white. Values are linear RGB.
const SKY = 2.2;
const SKY_COLOR = new Color().setRGB(1, 0.965, 0.92, LinearSRGBColorSpace);
const GROUND_COLOR = SKY_COLOR.clone().multiplyScalar(0.91);
const SUN = 1.397;
const SUN_COLOR = new Color().setRGB(0.842, 0.911, 1, LinearSRGBColorSpace);

interface PlasterNicheProps {
  className?: string;
  /** Recess depth as a fraction of the opening's shorter side. */
  depth?: number;
  /** Rendered on the niche floor, in units of the niche's height (1 = full height), origin at floor centre. */
  children?: ReactNode;
}

export function PlasterNiche({ className, depth = 0.6, children }: PlasterNicheProps) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <View ref={ref} className={cn('absolute inset-0', className)}>
      <NicheScene trackRef={ref} depth={depth}>
        {children}
      </NicheScene>
    </View>
  );
}

function NicheScene({ trackRef, depth, children }: { trackRef: React.RefObject<HTMLDivElement | null>; depth: number; children?: ReactNode }) {
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
  // Smaller shadow maps on phones; the niches are smaller there anyway.
  const shadowSize = useMemo(() => (window.innerWidth < 768 ? 1024 : 2048), []);

  // Runs before drei's View render (priority 1): fit the room to the DOM box and aim an off-axis camera through it.
  useFrame(() => {
    const el = trackRef.current;
    const cam = camera.current;
    if (!el || !cam || !back.current || !top.current || !bottom.current || !left.current || !right.current || !frame.current || !floor.current || !sun.current) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const w = rect.width * PX;
    const h = rect.height * PX;
    const d = Math.min(w, h) * depth;

    back.current.position.set(0, 0, -d);
    back.current.scale.set(w, h, 1);
    top.current.position.set(0, h / 2, -d / 2);
    top.current.scale.set(w, d, 1);
    bottom.current.position.set(0, -h / 2, -d / 2);
    bottom.current.scale.set(w, d, 1);
    left.current.position.set(-w / 2, 0, -d / 2);
    left.current.scale.set(d, h, 1);
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
      <mesh ref={top} material={material} rotation-x={Math.PI / 2} receiveShadow castShadow>
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

      {/* The wall face around the opening. Outside the view so never drawn, but it casts the lip shadow. */}
      <group ref={frame}>
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
