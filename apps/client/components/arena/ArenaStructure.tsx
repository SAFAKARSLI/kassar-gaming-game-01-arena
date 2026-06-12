'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, InstancedMesh, Object3D } from 'three';
import {
  ARENA_RADIUS,
  WALL_HEIGHT,
  WALL_THICKNESS,
  SPAWN_GATES,
  COVER_PILLARS,
  PLATFORMS,
} from '@arena/shared';
import { Flag } from './Flag';

const STONE = '#8b8170';
const STONE_DARK = '#6f6657';
const SAND = '#dcc38d';
const SAND_DARK = '#c8ad75';

const SEGMENTS = 30;
const FRONT_GAP = 0.55; // radians of open wall facing the camera (+Z)
const GATE_GAP = 0.34;

function isGap(theta: number): boolean {
  // Normalize to [-PI, PI]
  const norm = Math.atan2(Math.sin(theta), Math.cos(theta));
  if (Math.abs(norm) < FRONT_GAP) return true; // open front
  for (const g of SPAWN_GATES) {
    let d = norm - g.angle;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) < GATE_GAP) return true;
  }
  return false;
}

export function ArenaStructure({
  doorsOpenRef,
}: {
  doorsOpenRef: React.MutableRefObject<number>;
}) {
  return (
    <group>
      <SandFloor />
      <StoneWall />
      <RaisedPlatforms />
      <Ruins />
      {SPAWN_GATES.map((g, i) => (
        <Gate key={i} x={g.x} z={g.z} angle={g.angle} doorsOpenRef={doorsOpenRef} index={i} />
      ))}
      <Towers />
      <Banners />
      <CastleBackdrop />
    </group>
  );
}

// ---------------------------------------------------------------------------

function SandFloor() {
  return (
    <group>
      {/* Thick sand pad. */}
      <mesh position={[0, -0.5, 0]} receiveShadow>
        <cylinderGeometry args={[ARENA_RADIUS + 0.6, ARENA_RADIUS + 0.9, 1, 48]} />
        <meshStandardMaterial color={SAND} roughness={1} flatShading />
      </mesh>
      {/* Darker raked-sand inner ring for depth. */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[ARENA_RADIUS - 5, ARENA_RADIUS - 0.5, 48]} />
        <meshStandardMaterial color={SAND_DARK} roughness={1} />
      </mesh>
      {/* A few low dunes for subtle terrain variation. */}
      {DUNES.map((d, i) => (
        <mesh key={i} position={[d.x, 0.0, d.z]} scale={[d.s, d.h, d.s]}>
          <coneGeometry args={[1, 1, 6]} />
          <meshStandardMaterial color={SAND_DARK} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}

const DUNES = [
  { x: -5, z: 5, s: 1.4, h: 0.18 },
  { x: 6, z: 4, s: 1.1, h: 0.14 },
  { x: 2, z: -2, s: 1.6, h: 0.16 },
  { x: -7, z: -1, s: 1.2, h: 0.15 },
];

// ---------------------------------------------------------------------------

function StoneWall() {
  const wall = useRef<InstancedMesh>(null);
  const merlons = useRef<InstancedMesh>(null);

  const segs = useMemo(() => {
    const out: { x: number; z: number; rot: number; width: number }[] = [];
    const r = ARENA_RADIUS + WALL_THICKNESS / 2;
    const segWidth = ((2 * Math.PI * r) / SEGMENTS) * 1.06;
    for (let i = 0; i < SEGMENTS; i++) {
      const theta = (i / SEGMENTS) * Math.PI * 2;
      if (isGap(theta)) continue;
      out.push({ x: r * Math.sin(theta), z: r * Math.cos(theta), rot: theta, width: segWidth });
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    const o = new Object3D();
    segs.forEach((s, i) => {
      o.position.set(s.x, WALL_HEIGHT / 2, s.z);
      o.rotation.set(0, s.rot, 0);
      o.scale.set(s.width, WALL_HEIGHT, WALL_THICKNESS);
      o.updateMatrix();
      wall.current?.setMatrixAt(i, o.matrix);
      // Merlon on top.
      o.position.set(s.x, WALL_HEIGHT + 0.3, s.z);
      o.scale.set(s.width * 0.42, 0.7, WALL_THICKNESS * 1.05);
      o.updateMatrix();
      merlons.current?.setMatrixAt(i, o.matrix);
    });
    if (wall.current) wall.current.instanceMatrix.needsUpdate = true;
    if (merlons.current) merlons.current.instanceMatrix.needsUpdate = true;
  }, [segs]);

  return (
    <group>
      <instancedMesh ref={wall} args={[undefined, undefined, segs.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={STONE} roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={merlons} args={[undefined, undefined, segs.length]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={STONE_DARK} roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}

// ---------------------------------------------------------------------------

function RaisedPlatforms() {
  // Skip PLATFORMS[0] (the sand floor) — render the raised stone platforms.
  return (
    <group>
      {PLATFORMS.slice(1).map((p, i) => (
        <group key={i}>
          <mesh position={[p.cx, p.cy, p.cz]} castShadow receiveShadow>
            <boxGeometry args={[p.hx * 2, p.hy * 2, p.hz * 2]} />
            <meshStandardMaterial color={STONE} roughness={1} flatShading />
          </mesh>
          {/* Supporting base. */}
          <mesh position={[p.cx, (p.cy - p.hy) / 2, p.cz]}>
            <boxGeometry args={[p.hx * 1.7, p.cy - p.hy, p.hz * 1.7]} />
            <meshStandardMaterial color={STONE_DARK} roughness={1} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Ruins() {
  return (
    <group>
      {COVER_PILLARS.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh position={[0, p.height / 2, 0]} castShadow>
            <cylinderGeometry args={[p.radius, p.radius * 1.15, p.height, 8]} />
            <meshStandardMaterial color={p.broken ? STONE_DARK : STONE} roughness={1} flatShading />
          </mesh>
          {/* Capital / broken top. */}
          <mesh position={[0, p.height + 0.1, 0]} rotation={[0, 0, p.broken ? 0.25 : 0]} castShadow>
            <boxGeometry args={[p.radius * 2.4, 0.3, p.radius * 2.4]} />
            <meshStandardMaterial color={STONE} roughness={1} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------

function Gate({
  x,
  z,
  angle,
  index,
  doorsOpenRef,
}: {
  x: number;
  z: number;
  angle: number;
  index: number;
  doorsOpenRef: React.MutableRefObject<number>;
}) {
  const leftDoor = useRef<Group>(null);
  const rightDoor = useRef<Group>(null);
  const gateW = 3.2;
  const gateH = WALL_HEIGHT + 1.2;

  useFrame(() => {
    const open = doorsOpenRef.current; // 0 closed .. 1 open
    const a = open * 1.9;
    if (leftDoor.current) leftDoor.current.rotation.y = -a;
    if (rightDoor.current) rightDoor.current.rotation.y = a;
  });

  return (
    <group position={[x, 0, z]} rotation={[0, angle, 0]}>
      {/* Posts */}
      <mesh position={[-gateW / 2, gateH / 2, 0]} castShadow>
        <boxGeometry args={[0.8, gateH, WALL_THICKNESS + 0.5]} />
        <meshStandardMaterial color={STONE} roughness={1} flatShading />
      </mesh>
      <mesh position={[gateW / 2, gateH / 2, 0]} castShadow>
        <boxGeometry args={[0.8, gateH, WALL_THICKNESS + 0.5]} />
        <meshStandardMaterial color={STONE} roughness={1} flatShading />
      </mesh>
      {/* Arched lintel */}
      <mesh position={[0, gateH - 0.4, 0]} castShadow>
        <boxGeometry args={[gateW + 0.8, 1.1, WALL_THICKNESS + 0.5]} />
        <meshStandardMaterial color={STONE_DARK} roughness={1} flatShading />
      </mesh>
      <mesh position={[0, gateH + 0.4, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry
          args={[gateW / 2 + 0.2, gateW / 2 + 0.2, WALL_THICKNESS + 0.5, 12, 1, false, 0, Math.PI]}
        />
        <meshStandardMaterial color={STONE} roughness={1} flatShading />
      </mesh>
      {/* Wooden doors (hinged at the posts) */}
      <group ref={leftDoor} position={[-gateW / 2 + 0.1, 0, 0]}>
        <mesh position={[gateW / 4 - 0.05, gateH / 2 - 0.5, 0]} castShadow>
          <boxGeometry args={[gateW / 2 - 0.1, gateH - 1, 0.25]} />
          <meshStandardMaterial color="#5a3d23" roughness={0.9} flatShading />
        </mesh>
      </group>
      <group ref={rightDoor} position={[gateW / 2 - 0.1, 0, 0]}>
        <mesh position={[-gateW / 4 + 0.05, gateH / 2 - 0.5, 0]} castShadow>
          <boxGeometry args={[gateW / 2 - 0.1, gateH - 1, 0.25]} />
          <meshStandardMaterial color="#5a3d23" roughness={0.9} flatShading />
        </mesh>
      </group>
      {/* Banner over the gate */}
      <mesh position={[0, gateH - 0.4, WALL_THICKNESS / 2 + 0.3]}>
        <planeGeometry args={[1.4, 2]} />
        <meshStandardMaterial color={GATE_BANNER[index % GATE_BANNER.length]} side={2} roughness={0.85} />
      </mesh>
    </group>
  );
}

const GATE_BANNER = ['#b91c1c', '#1d4ed8', '#15803d'];

// ---------------------------------------------------------------------------

function Towers() {
  const towers = useMemo(
    () =>
      [-150, -105, 105, 150, 180].map((deg, i) => {
        const a = (deg * Math.PI) / 180;
        const r = ARENA_RADIUS + 10.5;
        return {
          x: Math.sin(a) * r,
          z: Math.cos(a) * r,
          color: TOWER_FLAGS[i % TOWER_FLAGS.length],
          h: 13 + (i % 2) * 2,
        };
      }),
    [],
  );

  return (
    <group>
      {towers.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]}>
          <mesh position={[0, t.h / 2, 0]} castShadow>
            <cylinderGeometry args={[2.2, 2.6, t.h, 12]} />
            <meshStandardMaterial color={STONE} roughness={1} flatShading />
          </mesh>
          {/* Crenellated top band */}
          <mesh position={[0, t.h + 0.3, 0]}>
            <cylinderGeometry args={[2.5, 2.5, 0.8, 12]} />
            <meshStandardMaterial color={STONE_DARK} roughness={1} flatShading />
          </mesh>
          {/* Conical roof */}
          <mesh position={[0, t.h + 2.2, 0]} castShadow>
            <coneGeometry args={[2.7, 3.4, 12]} />
            <meshStandardMaterial color="#7c2d12" roughness={0.9} flatShading />
          </mesh>
          <Flag position={[0, t.h + 3.6, 0]} color={t.color} poleHeight={3} seed={i} />
        </group>
      ))}
    </group>
  );
}

const TOWER_FLAGS = ['#b91c1c', '#1d4ed8', '#15803d', '#a16207', '#7e22ce'];

// ---------------------------------------------------------------------------

function Banners() {
  const banners = useMemo(() => {
    const out: { x: number; z: number; rot: number; color: string }[] = [];
    const angles = [-2.6, -2.1, -1.6, 1.6, 2.1, 2.6, 3.0];
    angles.forEach((theta, i) => {
      const r = ARENA_RADIUS + 0.1;
      out.push({
        x: Math.sin(theta) * r,
        z: Math.cos(theta) * r,
        rot: theta,
        color: BANNER_COLORS[i % BANNER_COLORS.length],
      });
    });
    return out;
  }, []);

  return (
    <group>
      {banners.map((b, i) => (
        <mesh key={i} position={[b.x, WALL_HEIGHT - 1.2, b.z]} rotation={[0, b.rot, 0]}>
          <planeGeometry args={[1.1, 2.6]} />
          <meshStandardMaterial color={b.color} side={2} roughness={0.85} flatShading />
        </mesh>
      ))}
    </group>
  );
}

const BANNER_COLORS = ['#b91c1c', '#1d4ed8', '#15803d', '#a16207', '#7e22ce', '#0f766e', '#9d174d'];

// ---------------------------------------------------------------------------

function CastleBackdrop() {
  // Big, low-detail castle silhouette far behind the back stands.
  return (
    <group position={[0, 0, -(ARENA_RADIUS + 26)]}>
      {/* Long curtain wall */}
      <mesh position={[0, 7, 0]}>
        <boxGeometry args={[60, 14, 4]} />
        <meshStandardMaterial color={STONE_DARK} roughness={1} flatShading />
      </mesh>
      {[-22, -8, 8, 22].map((x, i) => (
        <group key={i} position={[x, 0, 2]}>
          <mesh position={[0, 11, 0]}>
            <cylinderGeometry args={[3.2, 3.6, 22, 10]} />
            <meshStandardMaterial color={STONE} roughness={1} flatShading />
          </mesh>
          <mesh position={[0, 24, 0]}>
            <coneGeometry args={[3.8, 5, 10]} />
            <meshStandardMaterial color="#7c2d12" roughness={0.9} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}
