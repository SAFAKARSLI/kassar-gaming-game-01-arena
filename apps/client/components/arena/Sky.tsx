'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Group, ShaderMaterial } from 'three';

/** Cheap vertical-gradient sky dome + a warm sun + a few drifting low-poly clouds. */
export function Sky() {
  const skyMat = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: [0.27, 0.5, 0.86] }, // zenith blue
          bottom: { value: [0.8, 0.89, 0.98] }, // hazy horizon
        },
        vertexShader: `
          varying vec3 vWorld;
          void main() {
            vWorld = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vWorld;
          uniform vec3 top;
          uniform vec3 bottom;
          void main() {
            float h = clamp((normalize(vWorld).y + 0.1) / 0.9, 0.0, 1.0);
            gl_FragColor = vec4(mix(bottom, top, h), 1.0);
          }
        `,
      }),
    [],
  );

  const clouds = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        x: -90 + (i * 180) / 7 + Math.random() * 20,
        y: 32 + Math.random() * 22,
        z: -60 - Math.random() * 40,
        scale: 6 + Math.random() * 6,
        speed: 0.4 + Math.random() * 0.5,
      })),
    [],
  );
  const cloudGroup = useRef<Group>(null);

  useFrame((_state, delta) => {
    if (!cloudGroup.current) return;
    cloudGroup.current.children.forEach((c, i) => {
      c.position.x += clouds[i].speed * delta;
      if (c.position.x > 110) c.position.x = -110;
    });
  });

  return (
    <group>
      <mesh material={skyMat}>
        <sphereGeometry args={[160, 16, 12]} />
      </mesh>

      {/* Warm sun high in the back-left. */}
      <mesh position={[-40, 60, -80]}>
        <sphereGeometry args={[7, 16, 16]} />
        <meshBasicMaterial color="#fff6da" />
      </mesh>

      <group ref={cloudGroup}>
        {clouds.map((c, i) => (
          <group key={i} position={[c.x, c.y, c.z]} scale={c.scale}>
            <Cloud />
          </group>
        ))}
      </group>
    </group>
  );
}

function Cloud() {
  return (
    <group>
      {[
        [0, 0, 0, 1],
        [1, -0.1, 0, 0.8],
        [-1, -0.1, 0.2, 0.75],
        [0.4, 0.3, -0.2, 0.7],
        [-0.5, 0.25, 0.1, 0.6],
      ].map(([x, y, z, s], i) => (
        <mesh key={i} position={[x, y, z]} scale={[s * 1.3, s * 0.8, s]}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#ffffff" roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}
