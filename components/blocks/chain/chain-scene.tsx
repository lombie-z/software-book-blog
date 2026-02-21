'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// ── Chain config ──
const LINK_COUNT = 14; // visible links per chain
const ROPE_POINTS = 24; // MORE points than links → extra length = slack/sag
const SEGMENT_LEN = 28; // rest distance between rope points
const TUBE_R = 2.5;
const LINK_HALF_W = 7;
const LINK_STRAIGHT = 14;
const LINK_HEIGHT = 2 * (LINK_STRAIGHT + LINK_HALF_W); // 42px — full link extent along its long axis
const CARD_INSET = 40;
const GRAVITY = 2400;
const CONSTRAINT_ITERS = 16;
const DAMPING = 0.97;

// ── Verlet rope ──
interface VerletRope {
  pos: Float64Array; // [x0, y0, x1, y1, ...]
  prev: Float64Array;
  count: number;
}

function createRope(count: number, topX: number, topY: number, botX: number, botY: number): VerletRope {
  const pos = new Float64Array(count * 2);
  const prev = new Float64Array(count * 2);
  // Initialize as catenary-like curve (straight line + sag)
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const sag = Math.sin(t * Math.PI) * 80; // generous initial sag
    pos[i * 2] = topX + (botX - topX) * t + sag * 0.3; // slight horizontal droop
    pos[i * 2 + 1] = topY + (botY - topY) * t - sag;
    prev[i * 2] = pos[i * 2];
    prev[i * 2 + 1] = pos[i * 2 + 1];
  }
  return { pos, prev, count };
}

function stepRope(rope: VerletRope, dt: number, topX: number, topY: number, botX: number, botY: number) {
  const { pos, prev, count } = rope;

  // Verlet integration
  for (let i = 1; i < count - 1; i++) {
    const ix = i * 2;
    const iy = ix + 1;
    const vx = (pos[ix] - prev[ix]) * DAMPING;
    const vy = (pos[iy] - prev[iy]) * DAMPING;
    prev[ix] = pos[ix];
    prev[iy] = pos[iy];
    pos[ix] += vx;
    pos[iy] += vy - GRAVITY * dt * dt;
  }

  // Pin endpoints
  pos[0] = topX;
  pos[1] = topY;
  prev[0] = topX;
  prev[1] = topY;
  const lastI = (count - 1) * 2;
  pos[lastI] = botX;
  pos[lastI + 1] = botY;
  prev[lastI] = botX;
  prev[lastI + 1] = botY;

  // Distance constraints (forward + backward passes for stability)
  for (let iter = 0; iter < CONSTRAINT_ITERS; iter++) {
    // Alternate direction each iteration to reduce bias
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
      } else if (i === count - 2) {
        // Bottom pinned
        pos[ax] -= ox * 2;
        pos[ay] -= oy * 2;
      } else {
        pos[ax] -= ox;
        pos[ay] -= oy;
        pos[bx] += ox;
        pos[by] += oy;
      }
    }
  }
}

// ── Sample rope position at a given arc-length distance from the top ──
function sampleRopeByArc(rope: VerletRope, arcLen: Float64Array, targetArc: number): [number, number] {
  // Binary search for the segment containing targetArc
  let lo = 0;
  let hi = rope.count - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (arcLen[mid] < targetArc) lo = mid;
    else hi = mid;
  }

  const segArc = arcLen[hi] - arcLen[lo];
  const frac = segArc > 0.001 ? (targetArc - arcLen[lo]) / segArc : 0;

  const x = rope.pos[lo * 2] + (rope.pos[hi * 2] - rope.pos[lo * 2]) * frac;
  const y = rope.pos[lo * 2 + 1] + (rope.pos[hi * 2 + 1] - rope.pos[lo * 2 + 1]) * frac;
  return [x, y];
}

// ── Parametric stadium curve — smooth, no junction artifacts ──
class StadiumCurve extends THREE.Curve<THREE.Vector3> {
  halfW: number;
  straight: number;
  perimeter: number;

  constructor(halfW: number, straight: number) {
    super();
    this.halfW = halfW;
    this.straight = straight;
    // Perimeter = 2 straights + 2 semicircles
    this.perimeter = 2 * straight + 2 * Math.PI * halfW;
  }

  getPoint(t: number): THREE.Vector3 {
    const { halfW, straight, perimeter } = this;
    const d = t * perimeter;

    const seg1 = straight; // right side: (halfW, -straight) → (halfW, straight)
    const seg2 = seg1 + Math.PI * halfW; // top arc
    const seg3 = seg2 + straight; // left side: (-halfW, straight) → (-halfW, -straight)

    if (d <= seg1) {
      // Right straight: bottom to top
      const f = d / straight;
      return new THREE.Vector3(halfW, -straight + f * 2 * straight, 0);
    }
    if (d <= seg2) {
      // Top semicircle centered at (0, straight), from (halfW, straight) to (-halfW, straight)
      const a = (d - seg1) / halfW; // 0 → PI
      return new THREE.Vector3(halfW * Math.cos(a), straight + halfW * Math.sin(a), 0);
    }
    if (d <= seg3) {
      // Left straight: top to bottom
      const f = (d - seg2) / straight;
      return new THREE.Vector3(-halfW, straight - f * 2 * straight, 0);
    }
    // Bottom semicircle centered at (0, -straight), from (-halfW, -straight) to (halfW, -straight)
    const a = (d - seg3) / halfW; // 0 → PI
    return new THREE.Vector3(-halfW * Math.cos(a), -straight - halfW * Math.sin(a), 0);
  }
}

function createLinkGeometry(tubeR: number, halfW: number, straight: number): THREE.TubeGeometry {
  const curve = new StadiumCurve(halfW, straight);
  return new THREE.TubeGeometry(curve, 64, tubeR, 12, true);
}

export interface ChainCardState {
  screenY: number;
  tiltDeg: number;
  scale: number;
  cardW: number;
  originTop: boolean;
}

interface ChainSceneProps {
  chainProgressRef: React.RefObject<{ value: number }>;
  chainCardRef: React.RefObject<ChainCardState>;
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

// Reusable quaternion helpers for link orientation
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _qAlign = new THREE.Quaternion();
const _qTwist = new THREE.Quaternion();

export function ChainScene({ chainProgressRef, chainCardRef, viewW, viewH, cardH }: ChainSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || viewW === 0 || viewH === 0) return;

    // ── Three.js ──
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

    // Environment map
    const pmremGen = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x111118);
    const fillA = new THREE.PointLight(0x334455, 2, 2000);
    fillA.position.set(-300, 400, 200);
    envScene.add(fillA);
    const fillB = new THREE.PointLight(0x223344, 1.5, 2000);
    fillB.position.set(300, -200, -100);
    envScene.add(fillB);
    const envMap = pmremGen.fromScene(envScene, 0.04).texture;
    pmremGen.dispose();

    // ── Geometry & Materials ──
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

    function screenToThree(sx: number, sy: number): [number, number] {
      return [sx - viewW / 2, viewH / 2 - sy];
    }

    function getEndpoints(chainP: number) {
      const card = chainCardRef.current;
      if (!card) {
        return {
          leftTop: [0, viewH / 2] as [number, number],
          leftBot: [-100, 0] as [number, number],
          rightTop: [0, viewH / 2] as [number, number],
          rightBot: [100, 0] as [number, number],
        };
      }

      const backEdge = getCardBackEdge(card, viewH, cardH);
      const attachHalfX = Math.max(20, backEdge.halfWidth - CARD_INSET * card.scale * backEdge.perspFactor);

      const [lbx, lby] = screenToThree(viewW / 2 - attachHalfX, backEdge.screenY);
      const [rbx, rby] = screenToThree(viewW / 2 + attachHalfX, backEdge.screenY);

      // Top anchors: above viewport
      const ceilingY = viewH / 2 + 200;

      let topY: number;
      if (chainP <= 0.3) {
        const dropP = chainP / 0.3;
        const dropEase = 1 - Math.pow(1 - dropP, 2.5);
        const farAbove = viewH / 2 + ROPE_POINTS * SEGMENT_LEN + 400;
        topY = farAbove + (ceilingY - farAbove) * dropEase;
      } else if (chainP <= 0.4) {
        topY = ceilingY;
      } else {
        const pullP = (chainP - 0.4) / 0.6;
        const pullEase = pullP * pullP * (3 - 2 * pullP);
        topY = ceilingY + pullEase * (viewH + 400);
      }

      const [ltx] = screenToThree(viewW / 2 - attachHalfX, 0);
      const [rtx] = screenToThree(viewW / 2 + attachHalfX, 0);

      return {
        leftTop: [ltx, topY] as [number, number],
        leftBot: [lbx, lby] as [number, number],
        rightTop: [rtx, topY] as [number, number],
        rightBot: [rbx, rby] as [number, number],
      };
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
        renderer.clear();
        return;
      }

      const dt = lastTime ? Math.min((time - lastTime) / 1000, 1 / 30) : 1 / 60;
      lastTime = time;

      const ep = getEndpoints(chainP);

      if (!initialized || !ropeLeft || !ropeRight) {
        ropeLeft = createRope(ROPE_POINTS, ep.leftTop[0], ep.leftTop[1], ep.leftBot[0], ep.leftBot[1]);
        ropeRight = createRope(ROPE_POINTS, ep.rightTop[0], ep.rightTop[1], ep.rightBot[0], ep.rightBot[1]);
        initialized = true;
      }

      // Step physics
      stepRope(ropeLeft, dt, ep.leftTop[0], ep.leftTop[1], ep.leftBot[0], ep.leftBot[1]);
      stepRope(ropeRight, dt, ep.rightTop[0], ep.rightTop[1], ep.rightBot[0], ep.rightBot[1]);

      // Place links along rope, spaced by LINK_HEIGHT so they touch/overlap
      // First compute cumulative arc-length table for the rope
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

        // Chain of LINK_COUNT links, each LINK_HEIGHT tall, centered on the rope
        const chainLen = LINK_COUNT * LINK_HEIGHT;
        // Start offset: center the chain along the rope
        const startArc = Math.max(0, (totalLen - chainLen) / 2);

        for (let i = 0; i < LINK_COUNT; i++) {
          const idx = c * LINK_COUNT + i;

          // Arc-length position of this link's center
          const linkCenterArc = startArc + (i + 0.5) * LINK_HEIGHT;
          // Sample two points slightly apart for direction
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
            // Twist 90° around the LOCAL Y axis (the link's long axis) for interlocking
            _qTwist.setFromAxisAngle(_up, Math.PI / 2);
            _qAlign.multiply(_qTwist); // multiply = apply in local space
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
  }, [viewW, viewH, cardH, chainProgressRef, chainCardRef]);

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
