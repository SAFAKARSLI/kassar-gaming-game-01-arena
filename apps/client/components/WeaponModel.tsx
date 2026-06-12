'use client';

import { getWeapon, type WeaponId } from '@arena/shared';

/**
 * Low-poly weapon model, oriented so the business end points along -Z (forward).
 * Shared by the first-person viewmodel and the third-person gladiators.
 */
export function WeaponModel({ weapon, scale = 1 }: { weapon: string; scale?: number }) {
  const cfg = getWeapon(weapon);
  const c = cfg.color;
  const wood = '#5a3d23';
  const steel = '#cbd5e1';

  return <group scale={scale}>{renderWeapon(weapon as WeaponId, c, wood, steel)}</group>;
}

function renderWeapon(id: WeaponId, c: string, wood: string, steel: string) {
  switch (id) {
    case 'dagger':
      return (
        <>
          <mesh position={[0, 0, 0.06]}>
            <boxGeometry args={[0.05, 0.05, 0.18]} />
            <meshStandardMaterial color={wood} />
          </mesh>
          <mesh position={[0, 0, -0.28]}>
            <boxGeometry args={[0.05, 0.12, 0.5]} />
            <meshStandardMaterial color={c} metalness={0.5} roughness={0.3} />
          </mesh>
        </>
      );
    case 'sword':
    case 'excalibur':
      return (
        <>
          <mesh position={[0, 0, 0.1]}>
            <boxGeometry args={[0.05, 0.05, 0.22]} />
            <meshStandardMaterial color={wood} />
          </mesh>
          <mesh position={[0, 0, -0.02]}>
            <boxGeometry args={[0.28, 0.06, 0.06]} />
            <meshStandardMaterial color={id === 'excalibur' ? '#fde68a' : '#9ca3af'} metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0, -0.62]}>
            <boxGeometry args={[0.07, 0.14, 1.1]} />
            <meshStandardMaterial color={c} metalness={0.6} roughness={0.25} />
          </mesh>
        </>
      );
    case 'axe':
      return (
        <>
          <mesh position={[0, 0, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 1.0, 6]} />
            <meshStandardMaterial color={wood} />
          </mesh>
          <mesh position={[0.18, 0, -0.62]}>
            <boxGeometry args={[0.4, 0.34, 0.1]} />
            <meshStandardMaterial color={c} metalness={0.5} roughness={0.4} />
          </mesh>
        </>
      );
    case 'mace':
    case 'warhammer':
      return (
        <>
          <mesh position={[0, 0, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 1.0, 6]} />
            <meshStandardMaterial color={wood} />
          </mesh>
          <mesh position={[0, 0, -0.7]}>
            {id === 'warhammer' ? (
              <boxGeometry args={[0.34, 0.3, 0.3]} />
            ) : (
              <icosahedronGeometry args={[0.22, 0]} />
            )}
            <meshStandardMaterial color={c} metalness={0.5} roughness={0.4} flatShading />
          </mesh>
        </>
      );
    case 'spear':
      return (
        <>
          <mesh position={[0, 0, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 1.8, 6]} />
            <meshStandardMaterial color={wood} />
          </mesh>
          <mesh position={[0, 0, -1.05]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.08, 0.32, 6]} />
            <meshStandardMaterial color={steel} metalness={0.6} roughness={0.3} />
          </mesh>
        </>
      );
    case 'halberd':
      return (
        <>
          <mesh position={[0, 0, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 1.9, 6]} />
            <meshStandardMaterial color={wood} />
          </mesh>
          <mesh position={[0.16, 0, -0.9]}>
            <boxGeometry args={[0.34, 0.3, 0.08]} />
            <meshStandardMaterial color={c} metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, -1.12]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.06, 0.28, 6]} />
            <meshStandardMaterial color={steel} metalness={0.6} roughness={0.3} />
          </mesh>
        </>
      );
    case 'shieldsword':
      return (
        <>
          <mesh position={[0, 0, -0.5]}>
            <boxGeometry args={[0.06, 0.12, 0.9]} />
            <meshStandardMaterial color={steel} metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[-0.32, 0, -0.1]} rotation={[Math.PI / 2, 0, 0.3]}>
            <cylinderGeometry args={[0.32, 0.32, 0.08, 8]} />
            <meshStandardMaterial color={c} metalness={0.3} roughness={0.5} flatShading />
          </mesh>
        </>
      );
    case 'bow':
      return (
        <group rotation={[0, 0, 0]}>
          <mesh position={[0, 0.28, -0.2]} rotation={[0.4, 0, 0]}>
            <boxGeometry args={[0.04, 0.5, 0.04]} />
            <meshStandardMaterial color={c} />
          </mesh>
          <mesh position={[0, -0.28, -0.2]} rotation={[-0.4, 0, 0]}>
            <boxGeometry args={[0.04, 0.5, 0.04]} />
            <meshStandardMaterial color={c} />
          </mesh>
          <mesh position={[0, 0, -0.1]}>
            <boxGeometry args={[0.03, 0.7, 0.03]} />
            <meshStandardMaterial color="#e5e7eb" />
          </mesh>
        </group>
      );
    case 'crossbow':
      return (
        <>
          <mesh position={[0, 0, -0.3]}>
            <boxGeometry args={[0.08, 0.08, 0.7]} />
            <meshStandardMaterial color={wood} />
          </mesh>
          <mesh position={[0, 0, -0.5]}>
            <boxGeometry args={[0.7, 0.05, 0.05]} />
            <meshStandardMaterial color={c} />
          </mesh>
        </>
      );
    case 'throwingknives':
      return (
        <mesh position={[0, 0, -0.2]}>
          <boxGeometry args={[0.04, 0.1, 0.4]} />
          <meshStandardMaterial color={steel} metalness={0.6} roughness={0.3} />
        </mesh>
      );
    case 'grenade':
      return (
        <mesh position={[0, 0, -0.1]}>
          <icosahedronGeometry args={[0.16, 0]} />
          <meshStandardMaterial color={c} flatShading roughness={0.6} />
        </mesh>
      );
    case 'firebomb':
      return (
        <>
          <mesh position={[0, 0, -0.1]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshStandardMaterial color={c} emissive="#7c2d12" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0, 0.16, -0.1]}>
            <boxGeometry args={[0.05, 0.1, 0.05]} />
            <meshStandardMaterial color={wood} />
          </mesh>
        </>
      );
    case 'landmine':
    case 'spiketrap':
      return (
        <mesh position={[0, 0, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.16, 0.18, 0.1, 8]} />
          <meshStandardMaterial color={c} flatShading roughness={0.7} />
        </mesh>
      );
    default:
      return null;
  }
}
