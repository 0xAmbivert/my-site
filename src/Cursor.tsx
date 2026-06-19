import { useEffect, useRef } from "react"

/**
 * Noman — Cursor (main site only)
 * Warm golden-glow custom cursor with two premium behaviors:
 *  1) Elastic "water-like" stretch — the ring squashes & stretches toward the
 *     direction of motion (velocity based), then eases back. Most noticeable
 *     gliding over text.
 *  2) Translucent "cube" engulf — over an icon/emoji the ring morphs into a soft
 *     translucent warm rounded square that wraps the element without hiding it,
 *     then morphs back on leave.
 *
 * Mount ONCE, after the preloader finishes (main site only):
 *   {entered && <Cursor />}
 *
 * Targeting:
 *  - Cube engulf: <svg>, <img>, [data-cube], or [data-cursor="cube"]
 *    (wrap an emoji in <span data-cursor="cube">\u2728</span> to get the effect).
 *  - Glow grow: links, buttons, inputs, or [data-cursor="glow"].
 */

type CursorProps = {
	hoverSelector?: string
	cubeSelector?: string
}

const DEFAULT_HOVER =
	'a, button, [role="button"], input, textarea, select, label, summary, [data-cursor="glow"]'
const DEFAULT_CUBE = 'svg, img, [data-cube], [data-cursor="cube"]'

const STYLES = `
.cur-hide-native, .cur-hide-native *{ cursor:none !important; }
.cur-root{
  position:fixed; inset:0; pointer-events:none; z-index:9998;
  opacity:0; transition:opacity .3s ease;
}
.cur-root.cur-on{ opacity:1; }
.cur-dot,.cur-ring,.cur-glow{
  position:fixed; top:0; left:0; pointer-events:none; will-change:transform;
}
.cur-dot{
  width:6px; height:6px; border-radius:50%; background:#3a2c1c;
  transition:opacity .25s ease;
}
.cur-ring{
  width:42px; height:42px; border-radius:50%;
  border:1.5px solid rgba(58,44,28,.5);
  transition:width .4s cubic-bezier(.16,1,.3,1), height .4s cubic-bezier(.16,1,.3,1),
             border-radius .4s cubic-bezier(.16,1,.3,1), background .35s ease,
             border-color .35s ease, box-shadow .35s ease;
}
.cur-glow{
  width:60px; height:60px; border-radius:50%; opacity:.45; filter:blur(10px);
  background:radial-gradient(circle, rgba(232,197,129,.6), rgba(201,143,60,.18) 45%, transparent 70%);
  transition:opacity .35s ease, width .4s cubic-bezier(.16,1,.3,1), height .4s cubic-bezier(.16,1,.3,1);
}
.cur-root.is-active .cur-ring{
  border-color:rgba(201,143,60,.9);
  background:rgba(254,240,213,.08);
  box-shadow:0 0 26px 4px rgba(201,143,60,.4), inset 0 0 16px rgba(255,236,196,.35);
}
.cur-root.is-active .cur-glow{ opacity:1; width:150px; height:150px; }
.cur-root.is-active .cur-dot{ opacity:0; }
.cur-root.is-press .cur-glow{ opacity:1; width:120px; height:120px; }
.cur-ring.is-cube{
  border-radius:16px;
  border-color:rgba(201,143,60,.7);
  background:rgba(232,197,129,.16);
  box-shadow:0 0 30px 6px rgba(201,143,60,.35), inset 0 0 22px rgba(255,236,196,.3);
}
.cur-root.is-cube-on .cur-glow{ opacity:.7; }
.cur-root.is-cube-on .cur-dot{ opacity:0; }
@media (prefers-reduced-motion: reduce){
  .cur-ring,.cur-glow,.cur-dot{ transition:opacity .2s ease; }
}
`

export default function Cursor({
	hoverSelector = DEFAULT_HOVER,
	cubeSelector = DEFAULT_CUBE,
}: CursorProps) {
	const rootRef = useRef<HTMLDivElement>(null)
	const dotRef = useRef<HTMLDivElement>(null)
	const ringRef = useRef<HTMLDivElement>(null)
	const glowRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (typeof window === "undefined") return
		const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches
		if (!canHover) return

		const root = rootRef.current
		const dot = dotRef.current
		const ring = ringRef.current
		const glow = glowRef.current
		if (!root || !dot || !ring || !glow) return

		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		document.body.classList.add("cur-hide-native")

		let mx = window.innerWidth / 2
		let my = window.innerHeight / 2
		let dx = mx, dy = my, rx = mx, ry = my, gx = mx, gy = my
		let prevRx = rx, prevRy = ry, curStretch = 0
		let visible = false
		let cubeEl: Element | null = null

		const onMove = (e: MouseEvent) => {
			mx = e.clientX
			my = e.clientY
			if (!visible) {
				visible = true
				root.classList.add("cur-on")
			}
		}
		const enterCube = (el: Element) => {
			cubeEl = el
			root.classList.add("is-cube-on")
			ring.classList.add("is-cube")
		}
		const exitCube = () => {
			cubeEl = null
			root.classList.remove("is-cube-on")
			ring.classList.remove("is-cube")
			ring.style.width = ""
			ring.style.height = ""
		}
		const onOver = (e: MouseEvent) => {
			const tgt = e.target as Element
			const cube = tgt?.closest?.(cubeSelector)
			if (cube) {
				enterCube(cube)
				return
			}
			if (tgt?.closest?.(hoverSelector)) root.classList.add("is-active")
		}
		const onOut = (e: MouseEvent) => {
			const tgt = e.target as Element
			if (cubeEl && tgt?.closest?.(cubeSelector) === cubeEl) exitCube()
			if (tgt?.closest?.(hoverSelector)) root.classList.remove("is-active")
		}
		const onDown = () => root.classList.add("is-press")
		const onUp = () => root.classList.remove("is-press")
		const onEnterWin = () => root.classList.add("cur-on")
		const onLeaveWin = () => root.classList.remove("cur-on")

		window.addEventListener("mousemove", onMove)
		document.addEventListener("mouseover", onOver)
		document.addEventListener("mouseout", onOut)
		window.addEventListener("mousedown", onDown)
		window.addEventListener("mouseup", onUp)
		document.addEventListener("mouseenter", onEnterWin)
		document.addEventListener("mouseleave", onLeaveWin)

		let raf = 0
		const loop = () => {
			let tx = mx
			let ty = my
			if (cubeEl) {
				const r = cubeEl.getBoundingClientRect()
				tx = r.left + r.width / 2
				ty = r.top + r.height / 2
				ring.style.width = Math.round(r.width + 18) + "px"
				ring.style.height = Math.round(r.height + 18) + "px"
			}
			const lerp = cubeEl ? 0.22 : 0.18
			dx += (mx - dx) * 0.42
			dy += (my - dy) * 0.42
			rx += (tx - rx) * lerp
			ry += (ty - ry) * lerp
			gx += (mx - gx) * 0.12
			gy += (my - gy) * 0.12

			let ringTransform: string
			if (cubeEl) {
				curStretch += (0 - curStretch) * 0.2
				ringTransform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`
			} else {
				const vx = rx - prevRx
				const vy = ry - prevRy
				const speed = Math.hypot(vx, vy)
				const angle = (Math.atan2(vy, vx) * 180) / Math.PI
				const targetStretch = reduce ? 0 : Math.min(speed / 22, 0.55)
				curStretch += (targetStretch - curStretch) * 0.2
				const sx = 1 + curStretch
				const sy = 1 - curStretch * 0.55
				ringTransform = `translate(${rx}px,${ry}px) translate(-50%,-50%) rotate(${angle}deg) scale(${sx},${sy})`
			}
			prevRx = rx
			prevRy = ry

			ring.style.transform = ringTransform
			dot.style.transform = `translate(${dx}px,${dy}px) translate(-50%,-50%)`
			glow.style.transform = `translate(${gx}px,${gy}px) translate(-50%,-50%)`
			raf = requestAnimationFrame(loop)
		}
		raf = requestAnimationFrame(loop)

		return () => {
			cancelAnimationFrame(raf)
			window.removeEventListener("mousemove", onMove)
			document.removeEventListener("mouseover", onOver)
			document.removeEventListener("mouseout", onOut)
			window.removeEventListener("mousedown", onDown)
			window.removeEventListener("mouseup", onUp)
			document.removeEventListener("mouseenter", onEnterWin)
			document.removeEventListener("mouseleave", onLeaveWin)
			document.body.classList.remove("cur-hide-native")
		}
	}, [hoverSelector, cubeSelector])

	return (
		<div className="cur-root" ref={rootRef} aria-hidden="true">
			<style>{STYLES}</style>
			<div className="cur-glow" ref={glowRef} />
			<div className="cur-ring" ref={ringRef} />
			<div className="cur-dot" ref={dotRef} />
		</div>
	)
}
