import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, MeshDistortMaterial, Sparkles, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { PILLARS, CORE_FOUR } from '../data/pillars'

// Soft radial glow texture, made once on a canvas so no image assets are needed.
function useGlowTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.25, 'rgba(255,255,255,0.45)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(c)
  }, [])
}

function Glow({ color, scale, opacity = 0.9 }) {
  const tex = useGlowTexture()
  return (
    <sprite scale={[scale, scale, 1]}>
      <spriteMaterial map={tex} color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
    </sprite>
  )
}

function Core({ accent }) {
  const shell = useRef()
  const inner = useRef()
  useFrame((_, dt) => {
    shell.current.rotation.y += dt * 0.12
    shell.current.rotation.x += dt * 0.05
    inner.current.rotation.y -= dt * 0.2
  })
  return (
    <group>
      <Float speed={1.4} rotationIntensity={0.4} floatIntensity={0.6}>
        <mesh ref={inner}>
          <icosahedronGeometry args={[1, 12]} />
          <MeshDistortMaterial color={accent} emissive={accent} emissiveIntensity={0.12} roughness={0.18} metalness={0.35} clearcoat={1} clearcoatRoughness={0.1} iridescence={1} iridescenceIOR={1.6} distort={0.42} speed={2.2} />
        </mesh>
        <mesh ref={shell} scale={1.75}>
          <icosahedronGeometry args={[1, 1]} />
          <meshBasicMaterial color="#9fd8ff" wireframe transparent opacity={0.22} />
        </mesh>
        <Glow color={accent} scale={7} opacity={0.55} />
      </Float>
    </group>
  )
}

function Planet({ color, radius, speed, tilt, size, offset }) {
  const pivot = useRef()
  const body = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime * speed + offset
    body.current.position.set(Math.cos(t) * radius, 0, Math.sin(t) * radius)
    body.current.rotation.y += 0.01
  })
  return (
    <group ref={pivot} rotation={tilt}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.008, 8, 160]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} />
      </mesh>
      <group ref={body}>
        <mesh>
          <sphereGeometry args={[size, 32, 32]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} roughness={0.3} />
        </mesh>
        <Glow color={color} scale={size * 9} opacity={0.8} />
      </group>
    </group>
  )
}

// Camera follows the pointer and drifts back as the page scrolls.
function Rig({ reduced }) {
  const look = useRef(new THREE.Vector3())
  useFrame((state) => {
    const scroll = window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight)
    const px = reduced ? 0 : state.pointer.x
    const py = reduced ? 0 : state.pointer.y
    const cam = state.camera
    // Past the hero, pull back and slide the system to the right so content stays readable.
    const k = Math.min(1, scroll * 4)
    const tx = px * 1.2 + Math.sin(scroll * Math.PI * 2) * 1.5
    const ty = py * 0.8 + 1.2 + k * 2
    // Portrait phones: sit further back so the core does not swallow the text.
    const tz = (state.viewport.aspect < 0.8 ? 15 : 9) + k * 7
    cam.position.x += (tx - cam.position.x) * 0.04
    cam.position.y += (ty - cam.position.y) * 0.04
    cam.position.z += (tz - cam.position.z) * 0.04
    look.current.x += (-k * 6 - look.current.x) * 0.04
    cam.lookAt(look.current)
  })
  return null
}

const ORBITS = [
  { radius: 2.9, speed: 0.42, tilt: [0.35, 0, 0.1], size: 0.2, offset: 0 },
  { radius: 3.7, speed: 0.3, tilt: [-0.25, 0, 0.35], size: 0.24, offset: 1.6 },
  { radius: 4.6, speed: 0.22, tilt: [0.15, 0, -0.4], size: 0.18, offset: 3.2 },
  { radius: 5.5, speed: 0.16, tilt: [-0.4, 0, -0.1], size: 0.27, offset: 4.7 },
]

export default function Scene3D({ accent = '#7c5cff' }) {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return (
    <div className="scene" aria-hidden="true">
      <Canvas dpr={[1, 1.75]} camera={{ position: [0, 1.2, 9], fov: 50 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} frameloop={reduced ? 'demand' : 'always'}>
        <color attach="background" args={['#04050d']} />
        <fog attach="fog" args={['#04050d', 12, 30]} />
        <ambientLight intensity={0.25} />
        <directionalLight position={[4, 6, 5]} intensity={2.2} color="#ffffff" />
        <pointLight position={[5, 3, 5]} intensity={70} color="#4cc9f0" />
        <pointLight position={[-5, -3, 4]} intensity={70} color="#ff4fd8" />
        <pointLight position={[0, -5, -3]} intensity={50} color={accent} />
        <Core accent={accent} />
        {CORE_FOUR.map((k, i) => (
          <Planet key={k} color={PILLARS[k].color} {...ORBITS[i]} />
        ))}
        <Stars radius={60} depth={40} count={reduced ? 1500 : 4000} factor={3.2} saturation={0.6} fade speed={0.6} />
        <Sparkles count={reduced ? 40 : 120} scale={[14, 8, 14]} size={2.2} speed={0.35} color="#a7c7ff" opacity={0.7} />
        <Rig reduced={reduced} />
      </Canvas>
    </div>
  )
}
