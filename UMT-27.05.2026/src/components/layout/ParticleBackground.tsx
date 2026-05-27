import { useEffect, useMemo, useState } from "react"
import Particles, { initParticlesEngine } from "@tsparticles/react"
import { loadSlim } from "@tsparticles/slim"
import type { ISourceOptions } from "@tsparticles/engine"

type Variant = "global" | "sidebar"

interface Props {
  /** "global" = fixed full-viewport background. "sidebar" = absolute fill of parent. */
  variant?: Variant
}

/**
 * Cooper Standard brand atmosphere — drifting blue + gold particles with
 * hairline links that echo the swoosh in the logo. Non-interactive,
 * honors prefers-reduced-motion, and reactively swaps palette when
 * next-themes toggles the `dark` class on <html>.
 */
export function ParticleBackground({ variant = "global" }: Props) {
  const [ready, setReady] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine)
    }).then(() => setReady(true))
  }, [])

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains("dark"))
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])

  const options = useMemo<ISourceOptions>(() => {
    const blue = isDark ? "#7aa6ff" : "#1f4ea8"
    const gold = isDark ? "#f6c95a" : "#d9a629"
    const linkColor = isDark ? "#5b87e0" : "#1f4ea8"

    const isSidebar = variant === "sidebar"

    return {
      fullScreen: { enable: true },
      background: { color: { value: "transparent" } },
      detectRetina: true,
      fpsLimit: 60,
      particles: {
        number: {
          value: isSidebar ? 60 : 120,
          density: {
            enable: true,
            width: isSidebar ? 256 : 1920,
            height: isSidebar ? 800 : 1080,
          },
        },
        color: { value: [blue, gold] },
        shape: { type: "circle" },
        opacity: {
          value: isSidebar
            ? { min: 0.6, max: 0.95 }
            : { min: 0.6, max: 0.95 },
          animation: {
            enable: !reduced,
            speed: 0.4,
            sync: false,
            startValue: "random",
          },
        },
        size: { value: isSidebar ? { min: 1, max: 2.2 } : { min: 1, max: 2.6 } },
        links: {
          enable: true,
          distance: isSidebar ? 90 : 140,
          color: linkColor,
          opacity: isSidebar ? (isDark ? 0.32 : 0.22) : isDark ? 0.18 : 0.14,
          width: 1,
        },
        move: {
          enable: !reduced,
          speed: isSidebar ? 0.3 : 0.4,
          direction: "none",
          random: true,
          straight: false,
          outModes: { default: "out" },
        },
      },
      interactivity: {
        events: { onHover: { enable: false }, onClick: { enable: false } },
      },
    }
  }, [isDark, reduced, variant])

  if (!ready) return null

  const wrapperClass =
    variant === "sidebar"
      ? "pointer-events-none absolute inset-0 z-0 overflow-hidden"
      : "pointer-events-none fixed inset-0 z-0"

  const id = variant === "sidebar" ? "brand-particles-sidebar" : "brand-particles"

  return (
    <div aria-hidden className={wrapperClass} style={{ contain: "strict" }}>
      <Particles id={id} options={options} />
    </div>
  )
}
