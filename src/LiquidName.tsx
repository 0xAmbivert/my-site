import { useEffect, useRef } from "react"
import { Renderer, Program, Mesh, Triangle, Texture, Vec2, Flowmap } from "ogl"

/**
 * LiquidName — "Mouse Flowmap Deformation" (OGL) applied to the hero name.
 *
 * The name is drawn to a 2D canvas (matching the DOM font/size), uploaded as a
 * WebGL texture, and a flowmap accumulates the cursor's velocity to push the
 * text pixels around — the liquid, cursor-following smear seen on
 * clarissemichard.com. Sits as an absolutely-positioned overlay inside
 * `.hero-name`; the DOM glyphs are hidden (via `.is-liquid`) only once it
 * successfully activates — so any failure leaves the normal name visible.
 *
 * IMPORTANT: the WebGL context is built ONCE on mount. Prop changes such as a
 * theme color swap only update uniforms + redraw the text texture — they never
 * rebuild the context (rebuilding a context on the same canvas yields an
 * incomplete texture, which renders as a solid filled box).
 */
type LiquidNameProps = {
	words: string[]
	color?: string
	fontFamily?: string
	strength?: number
	shift?: number
	activateDelay?: number
	onActivate?: () => void
}

const VERT = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAG = `
precision highp float;
uniform sampler2D tMap;
uniform sampler2D tFlow;
uniform vec3 uColor;
uniform float uStrength;
uniform float uShift;
varying vec2 vUv;
void main() {
	vec3 flow = texture2D(tFlow, vUv).rgb;
	vec2 disp = flow.rg * uStrength;
	vec2 uv = vUv - disp;
	vec2 ca = flow.rg * uShift;
	float aR = texture2D(tMap, uv + ca).a;
	float aG = texture2D(tMap, uv).a;
	float aB = texture2D(tMap, uv - ca).a;
	float a = max(aR, max(aG, aB));
	if (a < 0.001) discard;
	gl_FragColor = vec4(uColor, a);
}
`

function hexToRgb(hex: string): [number, number, number] {
	let h = hex.replace("#", "").trim()
	if (h.length === 3) h = h.split("").map((c) => c + c).join("")
	const n = parseInt(h, 16)
	return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export default function LiquidName({
	words,
	color = "#1c333d",
	fontFamily = "Raleway, Inter, sans-serif",
	strength = 0.18,
	shift = 0.011,
	activateDelay = 1500,
	onActivate,
}: LiquidNameProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	// Latest prop values, readable from inside the one-time GL loop.
	const propsRef = useRef({ words, color, fontFamily, strength, shift, onActivate })
	propsRef.current = { words, color, fontFamily, strength, shift, onActivate }

	// Handles exposed by the running pipeline so prop-change effects can poke it
	// without rebuilding the WebGL context.
	const apiRef = useRef<{ draw: () => void; program: Program } | null>(null)

	// Build the pipeline exactly once.
	useEffect(() => {
		if (typeof window === "undefined") return
		const canvas = canvasRef.current
		if (!canvas) return
		const host = canvas.parentElement
		if (!host) return
		const log = (...a: unknown[]) => console.info("[LiquidName]", ...a)

		let raf = 0
		let disposed = false
		let ro: ResizeObserver | null = null
		let cleanupGl: (() => void) | null = null

		const init = () => {
			const dpr = Math.min(window.devicePixelRatio || 1, 2)

			let renderer: Renderer
			try {
				renderer = new Renderer({ canvas, alpha: true, dpr, premultipliedAlpha: false })
			} catch (e) {
				console.error("[LiquidName] WebGL unavailable — keeping plain name:", e)
				return
			}
			const gl = renderer.gl
			gl.clearColor(0, 0, 0, 0)

			const texCanvas = document.createElement("canvas")
			const texCtx = texCanvas.getContext("2d")
			if (!texCtx) {
				console.error("[LiquidName] no 2D context — keeping plain name")
				return
			}
			const texture = new Texture(gl, { image: texCanvas, generateMipmaps: false })
			const flowmap = new Flowmap(gl, { falloff: 0.3, dissipation: 0.92, alpha: 0.55 })
			const geometry = new Triangle(gl)
			const program = new Program(gl, {
				vertex: VERT,
				fragment: FRAG,
				uniforms: {
					tMap: { value: texture },
					tFlow: flowmap.uniform,
					uColor: { value: hexToRgb(propsRef.current.color) },
					uStrength: { value: propsRef.current.strength },
					uShift: { value: propsRef.current.shift },
				},
				transparent: true,
			})
			const mesh = new Mesh(gl, { geometry, program })

			const mouse = new Vec2(-1)
			const velocity = new Vec2()
			const lastMouse = new Vec2()
			let lastT = 0
			let moved = false

			const onMove = (e: MouseEvent) => {
				const rect = canvas.getBoundingClientRect()
				const x = e.clientX - rect.left
				const y = e.clientY - rect.top
				const pad = Math.max(rect.width, rect.height) * 0.65
				if (x < -pad || y < -pad || x > rect.width + pad || y > rect.height + pad) return
				const now = performance.now()
				mouse.set(x / Math.max(1, rect.width), 1 - y / Math.max(1, rect.height))
				if (!lastT) {
					lastT = now
					lastMouse.set(x, y)
					return
				}
				const dt = Math.max(12, now - lastT)
				lastT = now
				velocity.set((x - lastMouse.x) / dt, -(y - lastMouse.y) / dt)
				lastMouse.set(x, y)
				moved = true
			}

			const draw = () => {
				const { color: ink, fontFamily: ff, words: wds } = propsRef.current
				const rect = host.getBoundingClientRect()
				const w = Math.max(1, Math.round(rect.width))
				const h = Math.max(1, Math.round(rect.height))
				renderer.setSize(w, h)
				flowmap.aspect = w / h

				texCanvas.width = Math.round(w * dpr)
				texCanvas.height = Math.round(h * dpr)
				texCtx.clearRect(0, 0, texCanvas.width, texCanvas.height)
				texCtx.setTransform(dpr, 0, 0, dpr, 0, 0)

				const cs = window.getComputedStyle(host)
				const fontSize = parseFloat(cs.fontSize) || 96
				const weight = cs.fontWeight || "800"
				const lineHeight = 1.02
				texCtx.font = weight + " " + fontSize + "px " + ff
				texCtx.textBaseline = "top"
				texCtx.textAlign = "left"
				texCtx.fillStyle = ink

				const gap = fontSize * 0.3
				const lines: string[][] = [[]]
				let lineW = 0
				for (const word of wds) {
					const ww = texCtx.measureText(word).width
					const current = lines[lines.length - 1]
					const add = (current.length ? gap : 0) + ww
					if (lineW + add > w && current.length) {
						lines.push([word])
						lineW = ww
					} else {
						current.push(word)
						lineW += add
					}
				}

				const lineStep = fontSize * lineHeight
				let y = 0
				for (const line of lines) {
					let x = 0
					for (const word of line) {
						texCtx.fillText(word, x, y)
						x += texCtx.measureText(word).width + gap
					}
					y += lineStep
				}
				texCtx.setTransform(1, 0, 0, 1, 0, 0)
				texture.image = texCanvas
				texture.needsUpdate = true
				return { w, h }
			}

			let firstFrame = true
			const update = () => {
				raf = requestAnimationFrame(update)
				if (!moved) {
					mouse.set(-1, -1)
					velocity.set(0, 0)
				}
				flowmap.mouse.copy(mouse)
				flowmap.velocity.lerp(velocity, moved ? 0.5 : 0.1)
				flowmap.update()
				moved = false
				renderer.render({ scene: mesh })
				if (firstFrame) {
					firstFrame = false
					log("first frame rendered ✅")
				}
			}

			const size = draw()
			if (size.w < 2 || size.h < 2) {
				console.warn("[LiquidName] host box has no size yet:", size)
			}
			update()
			ro = new ResizeObserver(() => draw())
			ro.observe(host)
			window.addEventListener("mousemove", onMove)
			apiRef.current = { draw, program }
			cleanupGl = () => {
				apiRef.current = null
				window.removeEventListener("mousemove", onMove)
				const ext = gl.getExtension("WEBGL_lose_context")
				if (ext) ext.loseContext()
			}
			log("activated", size)
			propsRef.current.onActivate?.()
		}

		log("mounted; waiting for fonts…")
		const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve()
		Promise.resolve(fontsReady).then(() => {
			if (disposed) return
			log("fonts ready; activating in", activateDelay, "ms")
			window.setTimeout(() => {
				if (disposed) return
				try {
					init()
				} catch (e) {
					console.error("[LiquidName] init failed — keeping plain name:", e)
				}
			}, activateDelay)
		})

		return () => {
			disposed = true
			cancelAnimationFrame(raf)
			ro?.disconnect()
			cleanupGl?.()
		}
		// Build once; prop changes are handled by the effect below.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// Theme/tuning changes: update uniforms + redraw the text texture in place.
	// Never rebuilds the WebGL context, so no "solid box" on theme toggle.
	useEffect(() => {
		const api = apiRef.current
		if (!api) return
		api.program.uniforms.uColor.value = hexToRgb(color)
		api.program.uniforms.uStrength.value = strength
		api.program.uniforms.uShift.value = shift
		api.draw()
	}, [color, fontFamily, strength, shift, words])

	return <canvas ref={canvasRef} className="liquid-name-canvas" aria-hidden="true" />
}
