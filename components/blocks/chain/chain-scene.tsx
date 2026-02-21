'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// ── Chain config ──
const LINK_COUNT = 14;
const ROPE_POINTS = 28; // lots of slack for the coiled start
const SEGMENT_LEN = 24;
const TUBE_R = 2.5;
const LINK_HALF_W = 7;
const LINK_STRAIGHT = 14;
const LINK_HEIGHT = 2 * (LINK_STRAIGHT + LINK_HALF_W); // 42px
const CARD_INSET = 40;
const GRAVITY = 2400;
const CONSTRAINT_ITERS = 16;
const DAMPING = 0.97;

// ── Verlet rope — top pinned, bottom FREE with floor constraint ──
interface VerletRope {
  pos: Float64Array;
  prev: Float64Array;
  count: number;
}

function createRopeCoiled(count: number, anchorX: number, floorY: number): VerletRope {
  const pos = new Float64Array(count * 2);
  const prev = new Float64Array(count * 2);
  // Start coiled: zigzag pattern on the floor
  for (let i = 0; i < count; i++) {
    const zigzag = (i % 2 === 0 ? -1 : 1) * 15; // 15px side-to-side
    pos[i * 2] = anchorX + zigzag;
    // Stack points near the floor with tiny vertical offsets
    pos[i * 2 + 1] = floorY + (count - i) * 3; // slight pile-up above floor
    prev[i * 2] = pos[i * 2];
    prev[i * 2 + 1] = pos[i * 2 + 1];
  }
  return { pos, prev, count };
}

function stepRope(rope: VerletRope, dt: number, topX: number, topY: number, floorY: number, attachX: number) {
  const { pos, prev, count } = rope;

  // Verlet integration
  for (let i = 1; i < count; i++) {
    const ix = i * 2;
    const iy = ix + 1;
    const vx = (pos[ix] - prev[ix]) * DAMPING;
    const vy = (pos[iy] - prev[iy]) * DAMPING;
    prev[ix] = pos[ix];
    prev[iy] = pos[iy];
    pos[ix] += vx;
    pos[iy] += vy - GRAVITY * dt * dt;
  }

  // Pin top endpoint only
  pos[0] = topX;
  pos[1] = topY;
  prev[0] = topX;
  prev[1] = topY;

  // Distance constraints
  for (let iter = 0; iter < CONSTRAINT_ITERS; iter++) {
    const forward = iter % 2 === 0;
    const start = forward ? 0 : count - 2;
    const end = forward ? count - 1 : -1;
    const step = forward ? 1 : -1;

    for (let i = start; i !== end; i += step) {
      const ax = i * 2;
      const ay = ax + 1;
      const bx = (i + 1) * 2;
      const by = bx + 1;

      const dx = pos[bx] - pos[ax];
      const dy = pos[by] - pos[ay];
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.001) continue;

      const diff = (SEGMENT_LEN - dist) / dist * 0.5;
      const ox = dx * diff;
      const oy = dy * diff;

      if (i === 0) {
        // Top pinned
        pos[bx] += ox * 2;
        pos[by] += oy * 2;
      } else {
        pos[ax] -= ox;
        pos[ay] -= oy;
        pos[bx] += ox;
        pos[by] += oy;
      }
    }

    // Floor constraint: no point goes below floorY (in Three.js Y-up coords)
    for (let i = 1; i < count; i++) {
      if (pos[i * 2 + 1] < floorY) {
        pos[i * 2 + 1] = floorY;
        prev[i * 2 + 1] = floorY;
      }
    }

    // Bottom point X constraint: gently pull toward card attachment X
    const lastI = (count - 1) * 2;
    pos[lastI] += (attachX - pos[lastI]) * 0.3;
  }
}

// ── Sample rope by arc length ──
function sampleRopeByArc(rope: VerletRope, arcLen: Float64Array, targetArc: number): [number, number] {
  let lo = 0;
  let hi = rope.count - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (arcLen[mid] < targetArc) lo = mid;
    else hi = mid;
  }
  const segArc = arcLen[hi] - arcLen[lo];
  const frac = segArc > 0.001 ? (targetArc - arcLen[lo]) / segArc : 0;
  return [
    rope.pos[lo * 2] + (rope.pos[hi * 2] - rope.pos[lo * 2]) * frac,
    rope.pos[lo * 2 + 1] + (rope.pos[hi * 2 + 1] - rope.pos[lo * 2 + 1]) * frac,
  ];
}

// ── Smooth stadium curve for link shape ──
class StadiumCurve extends THREE.Curve<THREE.Vector3> {
  halfW: number;
  straight: number;
  perimeter: number;

  constructor(halfW: number, straight: number) {
    super();
    this.halfW = halfW;
    this.straight = straight;
    this.perimeter = 2 * straight + 2 * Math.PI * halfW;
  }

  getPoint(t: number): THREE.Vector3 {
    const { halfW, straight, perimeter } = this;
    const d = t * perimeter;
    const seg1 = straight;
    const seg2 = seg1 + Math.PI * halfW;
    const seg3 = seg2 + straight;

    if (d <= seg1) {
      const f = d / straight;
      return new THREE.Vector3(halfW, -straight + f * 2 * straight, 0);
    }
    if (d <= seg2) {
      const a = (d - seg1) / halfW;
      return new THREE.Vector3(halfW * Math.cos(a), straight + halfW * Math.sin(a), 0);
    }
    if (d <= seg3) {
      const f = (d - seg2) / straight;
      return new THREE.Vector3(-halfW, straight - f * 2 * straight, 0);
    }
    const a = (d - seg3) / halfW;
    return new THREE.Vector3(-halfW * Math.cos(a), -straight - halfW * Math.sin(a), 0);
  }
}

function createLinkGeometry(tubeR: number, halfW: number, straight: number): THREE.TubeGeometry {
  return new THREE.TubeGeometry(new StadiumCurve(halfW, straight), 64, tubeR, 12, true);
}

export interface ChainCardState {
  screenY: number;
  tiltDeg: number;
  scale: number;
  cardW: number;
  originTop: boolean;
}

export interface ChainLiftState {
  liftY: number; // screen Y for the card
  active: boolean;
}

interface ChainSceneProps {
  chainProgressRef: React.RefObject<{ value: number }>;
  chainCardRef: React.RefObject<ChainCardState>;
  chainLiftRef: React.RefObject<ChainLiftState>;
  viewW: number;
  viewH: number;
  cardH: number;
}

function getCardBackEdge(card: ChainCardState, viewH: number, cardH: number) {
  const tiltRad = (card.tiltDeg * Math.PI) / 180;
  const perspective = viewH;
  const originY = card.originTop ? card.screenY : card.screenY + cardH * card.scale;
  const localY = card.originTop ? cardH : -cardH;
  const backLocalY = localY * Math.cos(tiltRad) * card.scale;
  const backLocalZ = -Math.abs(localY) * Math.sin(tiltRad) * card.scale;
  const perspFactor = perspective / (perspective - backLocalZ);
  const backScreenY = originY + backLocalY * perspFactor;
  const backHalfWidth = (card.cardW * card.scale / 2) * perspFactor;
  return { screenY: backScreenY, halfWidth: backHalfWidth, perspFactor };
}

const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _qAlign = new THREE.Quaternion();
const _qTwist = new THREE.Quaternion();

export function ChainScene({ chainProgressRef, chainCardRef, chainLiftRef, viewW, viewH, cardH }: ChainSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || viewW === 0 || viewH === 0) return;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(viewW, viewH);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const fov = 2 * Math.atan(0.5) * (180 / Math.PI);
    const camera = new THREE.PerspectiveCamera(fov, viewW / viewH, 1, viewH * 4);
    camera.position.set(0, 0, viewH);

    scene.add(new THREE.AmbientLight(0x8888aa, 0.6));
    const dirLight = new THREE.DirectionalLight(0xccccff, 1.2);
    dirLight.position.set(100, 200, 150);
    scene.add(dirLight);
    const rimLight = new THREE.DirectionalLight(0x6666aa, 0.5);
    rimLight.position.set(-80, -100, 200);
    scene.add(rimLight);

    const pmremGen = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x111118);
    envScene.add(new THREE.PointLight(0x334455, 2, 2000));
    envScene.add(new THREE.PointLight(0x223344, 1.5, 2000));
    const envMap = pmremGen.fromScene(envScene, 0.04).texture;
    pmremGen.dispose();

    const linkGeo = createLinkGeometry(TUBE_R, LINK_HALF_W, LINK_STRAIGHT);
    const linkMat = new THREE.MeshStandardMaterial({
      metalness: 0.85,
      roughness: 0.25,
      color: new THREE.Color('#4a4a55'),
      emissive: new THREE.Color('#1a1a2e'),
      emissiveIntensity: 0.6,
      envMap,
      envMapIntensity: 0.8,
    });

    const glowGeo = createLinkGeometry(TUBE_R * 1.8, LINK_HALF_W * 1.2, LINK_STRAIGHT * 1.1);
    const glowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#3a3a5a'),
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const totalLinks = LINK_COUNT * 2;
    const linkMesh = new THREE.InstancedMesh(linkGeo, linkMat, totalLinks);
    const glowMesh = new THREE.InstancedMesh(glowGeo, glowMat, totalLinks);
    linkMesh.frustumCulled = false;
    glowMesh.frustumCulled = false;
    scene.add(linkMesh);
    scene.add(glowMesh);

    const dummy = new THREE.Object3D();

    let ropeLeft: VerletRope | null = null;
    let ropeRight: VerletRope | null = null;
    let initialized = false;

    function screenToThreeY(sy: number): number {
      return viewH / 2 - sy;
    }
    function screenToThreeX(sx: number): number {
      return sx - viewW / 2;
    }
    function threeToScreenY(ty: number): number {
      return viewH / 2 - ty;
    }

    // ── Animation loop ──
    let lastTime = 0;
    let rafId = 0;

    function animate(time: number) {
      rafId = requestAnimationFrame(animate);

      const chainP = chainProgressRef.current?.value ?? 0;
      if (chainP <= 0) {
        initialized = false;
        ropeLeft = null;
        ropeRight = null;
        if (chainLiftRef.current) chainLiftRef.current.active = false;
        renderer.clear();
        return;
      }

      const dt = lastTime ? Math.min((time - lastTime) / 1000, 1 / 30) : 1 / 60;
      lastTime = time;

      // Read current card state
      const card = chainCardRef.current;
      if (!card) return;

      const backEdge = getCardBackEdge(card, viewH, cardH);
      const attachHalfX = Math.max(20, backEdge.halfWidth - CARD_INSET * card.scale * backEdge.perspFactor);
      const leftAttachX = screenToThreeX(viewW / 2 - attachHalfX);
      const rightAttachX = screenToThreeX(viewW / 2 + attachHalfX);
      const floorThreeY = screenToThreeY(backEdge.screenY);

      // Top anchor Y: starts at floor, rises above viewport
      const ceilingY = viewH / 2 + 300;
      let topY: number;
      if (chainP <= 0.15) {
        // Chains resting on floor, fading in
        topY = floorThreeY + 20;
      } else {
        // Pull upward
        const pullP = (chainP - 0.15) / 0.85;
        const pullEase = pullP * pullP * (3 - 2 * pullP);
        topY = floorThreeY + 20 + pullEase * (ceilingY - floorThreeY + viewH);
      }

      // Initialize ropes coiled on floor
      if (!initialized || !ropeLeft || !ropeRight) {
        ropeLeft = createRopeCoiled(ROPE_POINTS, leftAttachX, floorThreeY);
        ropeRight = createRopeCoiled(ROPE_POINTS, rightAttachX, floorThreeY);
        initialized = true;
      }

      // Step physics — top pinned, bottom free with floor constraint
      stepRope(ropeLeft, dt, leftAttachX, topY, floorThreeY, leftAttachX);
      stepRope(ropeRight, dt, rightAttachX, topY, floorThreeY, rightAttachX);

      // Read bottom position (the free end attached to card)
      const lbY = ropeLeft.pos[(ropeLeft.count - 1) * 2 + 1];
      const rbY = ropeRight.pos[(ropeRight.count - 1) * 2 + 1];
      const avgBottomThreeY = (lbY + rbY) / 2;

      // Write lift position back to scroll stage if bottom has risen above floor
      if (avgBottomThreeY > floorThreeY + 5) {
        const liftScreenY = threeToScreenY(avgBottomThreeY);
        // Map back: the card's screenY should be such that its back edge is at liftScreenY
        // backEdge.screenY was computed from card.screenY, so the offset is:
        const edgeOffset = backEdge.screenY - card.screenY;
        if (chainLiftRef.current) {
          chainLiftRef.current.liftY = liftScreenY - edgeOffset;
          chainLiftRef.current.active = true;
        }
      } else {
        if (chainLiftRef.current) chainLiftRef.current.active = false;
      }

      // ── Place chain links along ropes ──
      const ropes = [ropeLeft, ropeRight];
      for (let c = 0; c < 2; c++) {
        const rope = ropes[c];

        // Build arc-length table
        const arcLen = new Float64Array(rope.count);
        arcLen[0] = 0;
        for (let j = 1; j < rope.count; j++) {
          const dx = rope.pos[j * 2] - rope.pos[(j - 1) * 2];
          const dy = rope.pos[j * 2 + 1] - rope.pos[(j - 1) * 2 + 1];
          arcLen[j] = arcLen[j - 1] + Math.sqrt(dx * dx + dy * dy);
        }
        const totalLen = arcLen[rope.count - 1];

        const chainLen = LINK_COUNT * LINK_HEIGHT;
        // Place links from the bottom of the rope upward (bottom = card end)
        const startArc = Math.max(0, totalLen - chainLen);

        for (let i = 0; i < LINK_COUNT; i++) {
          const idx = c * LINK_COUNT + i;
          const linkCenterArc = startArc + (i + 0.5) * LINK_HEIGHT;
          if (linkCenterArc > totalLen) {
            // Link beyond rope — hide it
            dummy.position.set(0, -99999, 0);
            dummy.updateMatrix();
            linkMesh.setMatrixAt(idx, dummy.matrix);
            glowMesh.setMatrixAt(idx, dummy.matrix);
            continue;
          }

          const arcA = Math.max(0, linkCenterArc - LINK_HEIGHT * 0.3);
          const arcB = Math.min(totalLen, linkCenterArc + LINK_HEIGHT * 0.3);
          const [xa, ya] = sampleRopeByArc(rope, arcLen, arcA);
          const [xb, yb] = sampleRopeByArc(rope, arcLen, arcB);
          const [xc, yc] = sampleRopeByArc(rope, arcLen, Math.min(totalLen, linkCenterArc));

          const dx = xb - xa;
          const dy = yb - ya;
          const len = Math.sqrt(dx * dx + dy * dy);

          _dir.set(dx / (len || 1), dy / (len || 1), 0);
          _qAlign.setFromUnitVectors(_up, _dir);

          if (i % 2 !== 0) {
            _qTwist.setFromAxisAngle(_up, Math.PI / 2);
            _qAlign.multiply(_qTwist);
          }

          dummy.position.set(xc, yc, 0);
          dummy.quaternion.copy(_qAlign);
          dummy.updateMatrix();
          linkMesh.setMatrixAt(idx, dummy.matrix);
          glowMesh.setMatrixAt(idx, dummy.matrix);
        }
      }

      linkMesh.instanceMatrix.needsUpdate = true;
      glowMesh.instanceMatrix.needsUpdate = true;

      // Fade chains in/out
      const fadeIn = Math.min(1, chainP / 0.1);
      const fadeOut = chainP > 0.9 ? Math.max(0, 1 - (chainP - 0.9) / 0.1) : 1;
      const chainOpacity = fadeIn * fadeOut;
      linkMat.opacity = chainOpacity;
      linkMat.transparent = chainOpacity < 1;
      glowMat.opacity = 0.15 * chainOpacity;

      renderer.render(scene, camera);
    }

    rafId = requestAnimationFrame(animate);

    cleanupRef.current = () => {
      cancelAnimationFrame(rafId);
      renderer.dispose();
      linkGeo.dispose();
      linkMat.dispose();
      glowGeo.dispose();
      glowMat.dispose();
      envMap.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [viewW, viewH, cardH, chainProgressRef, chainCardRef, chainLiftRef]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 4,
        pointerEvents: 'none',
      }}
    />
  );
}
