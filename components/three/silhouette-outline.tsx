'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFBO } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, HalfFloatType, type Mesh, MeshBasicMaterial, NearestFilter, NoBlending, type Object3D, ShaderMaterial, Vector2, Vector3 } from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

// Sticker-style outline: renders the model's silhouette into a mask each frame, turns that into a distance field with
// a jump flood, then draws a white band with a thin dark rim from the field. Follows rotation and animation because it
// is the real silhouette. Searching the mask per pixel for the nearest edge took most of the page's frame time.

// The flood runs at half the canvas's resolution: the field is smooth, so it scales up cleanly.
const FIELD_SCALE = 0.5;
const FAR = 1000;

const passVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Each texel of the flood holds the UV of the nearest silhouette texel found so far, or -1 for none yet.
const seedFragmentShader = /* glsl */ `
  uniform sampler2D uMask;
  varying vec2 vUv;
  void main() {
    gl_FragColor = vec4(texture2D(uMask, vUv).r > 0.5 ? vUv : vec2(-1.0), 0.0, 1.0);
  }
`;

const floodFragmentShader = /* glsl */ `
  uniform sampler2D uSeeds;
  uniform vec2 uTexel;
  uniform float uStep;
  varying vec2 vUv;
  void main() {
    vec2 best = vec2(-1.0);
    float bestDistance = 1e12;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 seed = texture2D(uSeeds, vUv + vec2(float(x), float(y)) * uStep * uTexel).xy;
        if (seed.x < 0.0) continue;
        vec2 offset = (seed - vUv) / uTexel;
        float distance = dot(offset, offset);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = seed;
        }
      }
    }
    gl_FragColor = vec4(best, 0.0, 1.0);
  }
`;

// Distance to the silhouette in canvas pixels. Its target filters linearly, which smooths the band's edge.
const distanceFragmentShader = /* glsl */ `
  uniform sampler2D uSeeds;
  uniform vec2 uResolution;
  varying vec2 vUv;
  void main() {
    vec2 seed = texture2D(uSeeds, vUv).xy;
    gl_FragColor = vec4(seed.x < 0.0 ? ${FAR.toFixed(1)} : length((seed - vUv) * uResolution), 0.0, 0.0, 1.0);
  }
`;

const vertexShader = /* glsl */ `
  uniform float uDepth;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, uDepth, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMask;
  uniform sampler2D uDistance;
  uniform float uWidth;
  uniform float uRim;
  uniform vec3 uColor;
  uniform vec3 uRimColor;
  varying vec2 vUv;
  void main() {
    float dist = texture2D(uDistance, vUv).r;
    float reach = uWidth + uRim;
    if (dist > reach || texture2D(uMask, vUv).r > 0.5) discard;
    float edge = reach / 12.0;
    float rim = smoothstep(uWidth - edge * 0.5, uWidth + edge * 0.5, dist);
    float alpha = 1.0 - smoothstep(reach - edge, reach, dist);
    gl_FragColor = vec4(mix(uColor, uRimColor, rim), alpha);
  }
`;

const passMaterial = (fragment: string, uniforms: ShaderMaterial['uniforms']) =>
  new ShaderMaterial({ vertexShader: passVertexShader, fragmentShader: fragment, uniforms, blending: NoBlending, depthTest: false, depthWrite: false });

const FLOOD_TARGET = { depthBuffer: false, type: HalfFloatType, minFilter: NearestFilter, magFilter: NearestFilter };

const projected = new Vector3();

interface SilhouetteOutlineProps {
  /** Objects whose silhouette gets the outline. */
  target: Object3D;
  /** Objects hidden from the silhouette (left un-outlined). */
  exclude: (object: Object3D) => boolean;
  /** World-space point the sticker sits at in depth: things nearer pass in front of the band, farther pass behind. */
  depthAt: Vector3;
  /** Outline widths in CSS pixels. */
  width?: number;
  rim?: number;
  color?: string;
  rimColor?: string;
}

export function SilhouetteOutline({ target, exclude, depthAt, width = 12, rim = 2.5, color = '#ffffff', rimColor = '#2f2a27' }: SilhouetteOutlineProps) {
  const dpr = useThree((s) => s.viewport.dpr);
  const size = useThree((s) => s.size);
  const fieldWidth = Math.max(1, Math.ceil(size.width * dpr * FIELD_SCALE));
  const fieldHeight = Math.max(1, Math.ceil(size.height * dpr * FIELD_SCALE));
  const mask = useFBO();
  const floodA = useFBO(fieldWidth, fieldHeight, FLOOD_TARGET);
  const floodB = useFBO(fieldWidth, fieldHeight, FLOOD_TARGET);
  const field = useFBO(fieldWidth, fieldHeight, { depthBuffer: false, type: HalfFloatType });
  const quad = useRef<Mesh>(null);
  const maskMaterial = useMemo(() => new MeshBasicMaterial({ color: 'white' }), []);

  const passes = useMemo(
    () => ({
      quad: new FullScreenQuad(),
      seed: passMaterial(seedFragmentShader, { uMask: { value: mask.texture } }),
      flood: passMaterial(floodFragmentShader, { uSeeds: { value: null }, uTexel: { value: new Vector2() }, uStep: { value: 1 } }),
      distance: passMaterial(distanceFragmentShader, { uSeeds: { value: null }, uResolution: { value: new Vector2() } }),
    }),
    [mask]
  );

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uMask: { value: mask.texture },
          uDistance: { value: field.texture },
          uDepth: { value: 0.999 },
          uWidth: { value: 0 },
          uRim: { value: 0 },
          uColor: { value: new Color(color) },
          uRimColor: { value: new Color(rimColor) },
        },
        transparent: true,
        depthTest: true,
        depthWrite: false,
      }),
    [mask, field, color, rimColor]
  );

  useEffect(
    () => () => {
      passes.quad.dispose();
      passes.seed.dispose();
      passes.flood.dispose();
      passes.distance.dispose();
    },
    [passes]
  );

  // After the scene's own animation (-0.5), before R3F draws the frame. Negative, because any positive priority turns
  // off R3F's own rendering for the canvas.
  useFrame((state) => {
    const { gl, scene, camera } = state;
    const hidden: Object3D[] = [];
    scene.traverse((o) => {
      if (o.visible && (o === quad.current || (o !== target && exclude(o)))) {
        o.visible = false;
        hidden.push(o);
      }
    });
    const previousOverride = scene.overrideMaterial;
    const previousTarget = gl.getRenderTarget();
    scene.overrideMaterial = maskMaterial;
    gl.setRenderTarget(mask);
    gl.setClearColor(0x000000, 0);
    gl.clear();
    gl.render(scene, camera);
    scene.overrideMaterial = previousOverride;
    for (const o of hidden) o.visible = true;

    const bandWidth = width * dpr;
    const bandRim = rim * dpr;

    const draw = (pass: ShaderMaterial, into: typeof mask) => {
      passes.quad.material = pass;
      gl.setRenderTarget(into);
      passes.quad.render(gl);
    };

    // Flood out only as far as the band reaches: halving jumps add up to one less than twice the first.
    const reach = (bandWidth + bandRim) * FIELD_SCALE;
    let jump = 1;
    while (jump * 2 - 1 < reach) jump *= 2;

    draw(passes.seed, floodA);
    let read = floodA;
    let write = floodB;
    passes.flood.uniforms.uTexel.value.set(1 / floodA.width, 1 / floodA.height);
    for (; jump >= 1; jump /= 2) {
      passes.flood.uniforms.uSeeds.value = read.texture;
      passes.flood.uniforms.uStep.value = jump;
      draw(passes.flood, write);
      [read, write] = [write, read];
    }
    passes.distance.uniforms.uSeeds.value = read.texture;
    passes.distance.uniforms.uResolution.value.set(mask.width, mask.height);
    draw(passes.distance, field);
    gl.setRenderTarget(previousTarget);

    material.uniforms.uDepth.value = projected.copy(depthAt).project(camera).z;
    material.uniforms.uWidth.value = bandWidth;
    material.uniforms.uRim.value = bandRim;
  }, -0.25);

  return (
    <mesh ref={quad} material={material} frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
