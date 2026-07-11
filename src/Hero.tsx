import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Lenis from "lenis"
import Cursor from "./Cursor"
import LiquidName from "./LiquidName"
import PhotoAvatar from "./PhotoAvatar"
import styles from "./Hero.module.css"

/**
 * Noman — Hero / main scrollable page (PC layout)
 *
 * Props:
 *  - start:      begin the intro + enable the custom cursor (default true, so
 *                <Hero /> works standalone). In the merged app pass start={entered}.
 *  - withCurtain: enable the preloader handoff. A full-screen curtain (same color
 *                as the preloader's end state) collapses into the card's TOP
 *                outline, the card forms downward, then the text reveals.
 *
 * Requires: npm i gsap
 */

type HeroProps = {
	start?: boolean
	withCurtain?: boolean
}

const ROLES = "Developer — Nerd — Degen"
const NAME_WORDS = ["Muhammad", "Noman"]
const CURTAIN_COLOR = "rgba(201,143,60,0.92)"

const PROJECTS = [
	{
		index: "01",
		name: "Aurora",
		role: "Web Experience",
		desc: "An immersive, motion-led landing experience with custom WebGL transitions.",
		tags: ["React", "GSAP", "WebGL"],
	},
	{
		index: "02",
		name: "Nimbus",
		role: "Design System",
		desc: "A scalable component library and token system powering multiple products.",
		tags: ["TypeScript", "Figma", "Storybook"],
	},
	{
		index: "03",
		name: "Pulse",
		role: "Realtime App",
		desc: "A low-latency realtime dashboard streaming live data with buttery charts.",
		tags: ["Node", "WebSockets", "D3"],
	},
]

function splitChars(text: string, cls: string) {
	return text.split("").map((c, i) => (
		<span key={i} className={cls}>
			{c === " " ? " " : c}
		</span>
	))
}

export default function Hero({ start = true, withCurtain = false }: HeroProps) {
	const rootRef = useRef<HTMLDivElement>(null)
	const nameRef = useRef<HTMLDivElement>(null)
	const introPlayedRef = useRef(false)
	const heroCardRef = useRef<HTMLDivElement>(null)
	const lenisRef = useRef<Lenis | null>(null)
	const scrollTriggerRef = useRef<ScrollTrigger | null>(null)
	const [themed, setThemed] = useState(() => {
		try {
			return localStorage.getItem("theme") === "hershey"
		} catch {
			return false
		}
	})
	const [liquidOn, setLiquidOn] = useState(false)
	const activateLiquid = useCallback(() => setLiquidOn(true), [])

	// ---- GSAP: initial states, standalone intro, pinned scroll choreography ----
	useEffect(() => {
		if (typeof window === "undefined") return
		const root = rootRef.current
		if (!root) return
		gsap.registerPlugin(ScrollTrigger)

		// smooth momentum (lerp) scrolling, synced to ScrollTrigger
		const lenis = new Lenis({
			duration: 1.15,
			easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
			smoothWheel: true,
		})
		lenisRef.current = lenis
		lenis.on("scroll", ScrollTrigger.update)
		const tickerCb = (time: number) => lenis.raf(time * 1000)
		gsap.ticker.add(tickerCb)
		gsap.ticker.lagSmoothing(0)

		const ctx = gsap.context(() => {
			if (withCurtain) {
				// hidden until the preloader hands off
				gsap.set(".hero-card", { clipPath: "inset(0% 0% 100% 0%)", opacity: 1 })
				gsap.set(".hero-name .h-char", { yPercent: 130, opacity: 0 })
				gsap.set(".hero-roles .t-char", { yPercent: 120, opacity: 0 })
				gsap.set(".hero-corner", { opacity: 0, y: 18 })
				gsap.set(".hero-curtain", { autoAlpha: 1 })
			} else {
				// standalone: play the card-form + text intro right away
				gsap
					.timeline({ defaults: { ease: "power3.out" } })
					.fromTo(
						".hero-card",
						{ clipPath: "inset(0% 0% 100% 0%)", opacity: 0 },
						{ clipPath: "inset(0% 0% 0% 0%)", opacity: 1, duration: 1.4 },
					)
					.from(".hero-name .h-char", { yPercent: 130, opacity: 0, stagger: 0.05, duration: 0.85, ease: "back.out(1.6)" }, "-=0.6")
					.from(".hero-roles .t-char", { yPercent: 120, opacity: 0, stagger: 0.02, duration: 0.5 }, "-=0.45")
					.from(".hero-corner", { opacity: 0, y: 18, stagger: 0.18, duration: 0.7 }, "-=0.2")
					.set(".hero-card", { clearProps: "clipPath" })
			}

			gsap.set(".proj-sec", { yPercent: 100 })

			// hero card exits UP and out the top; the projects panel rises UP from below into its own place — one pinned stage
			const scrollTl = gsap
				.timeline({
					scrollTrigger: {
						trigger: ".scroll-stage",
						start: "top top",
						end: "+=2800",
						scrub: 1,
						pin: true,
						anticipatePin: 1,
					},
				})
				// hero lines peel up first
				.to(".hero-line", { yPercent: -60, opacity: 0, stagger: 0.15, ease: "none", duration: 0.7 }, 0)
				// hero card disappears UP and out the top of the page
				.to(".hero-card", { yPercent: -130, opacity: 0, ease: "none", duration: 1.2 }, 0)
				// projects panel rises UP from below into its own place, synced (it does NOT take the hero's spot)
				.to(".proj-sec", { yPercent: 0, ease: "none", duration: 1.2 }, 0)
				.from(".proj-title", { opacity: 0, y: 26, ease: "power3.out", duration: 0.6 }, ">-0.1")
				.from(
					".proj-pallet",
					{ opacity: 0, xPercent: 60, yPercent: 10, ease: "power3.out", duration: 1, stagger: { each: 0.5, from: "end" } },
					">-0.1",
				)
				.from(
					".pp-reveal",
					{ opacity: 0, x: 34, ease: "power3.out", duration: 0.5, stagger: { each: 0.06, from: "end" } },
					"<0.3",
				)

			scrollTriggerRef.current = scrollTl.scrollTrigger ?? null
		}, root)

		return () => {
			ctx.revert()
			gsap.ticker.remove(tickerCb)
			lenis.destroy()
			lenisRef.current = null
			scrollTriggerRef.current = null
		}
	}, [withCurtain])

	// ---- start: enable cursor + play the curtain handoff intro ----
	useEffect(() => {
		if (typeof window === "undefined") return
		if (!start) return
		const root = rootRef.current
		if (!root) return

		// curtain handoff intro (merged mode only)
		let introTl: gsap.core.Timeline | null = null
		if (withCurtain && !introPlayedRef.current) {
			introPlayedRef.current = true
			const card = root.querySelector(".hero-card") as HTMLElement | null
			const rect = card ? card.getBoundingClientRect() : null
			introTl = gsap.timeline({ defaults: { ease: "power4.inOut" } })
			if (rect) {
				// begin exactly where the preloader handed off: the card's TOP outline as a thin line
				introTl.set(".hero-curtain", {
					top: rect.top - 2,
					left: rect.left,
					width: rect.width,
					height: 4,
					borderRadius: 4,
					backgroundColor: "rgba(255,255,255,0.9)",
					autoAlpha: 1,
				})
			} else {
				introTl.set(".hero-curtain", {
					top: 0,
					left: 0,
					width: window.innerWidth,
					height: window.innerHeight,
					borderRadius: 0,
					backgroundColor: CURTAIN_COLOR,
					autoAlpha: 1,
				})
			}
			// the card forms downward from that top line
			introTl.to(".hero-card", { clipPath: "inset(0% 0% 0% 0%)", duration: 1.1, ease: "power4.inOut" })
			// the line fades as the card border takes over
			introTl.to(".hero-curtain", { autoAlpha: 0, duration: 0.5 }, "<0.2")
			// premium text reveal
			introTl.to(".hero-name .h-char", { yPercent: 0, opacity: 1, stagger: 0.05, duration: 0.85, ease: "back.out(1.6)" }, ">-0.35")
			introTl.to(".hero-roles .t-char", { yPercent: 0, opacity: 1, stagger: 0.02, duration: 0.5, ease: "power3.out" }, "-=0.45")
			introTl.to(".hero-corner", { opacity: 1, y: 0, stagger: 0.18, duration: 0.7, ease: "power2.out" }, "-=0.2")
			introTl.set(".hero-card", { clearProps: "clipPath" })
		}

		return () => {
			if (introTl) introTl.kill()
		}
	}, [start, withCurtain])

	// ---- liquid flowmap distortion on the name handled by <LiquidName /> (WebGL/OGL) ----

	const handleCardGlow = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
		const card = e.currentTarget
		if (!card) return
		const rect = card.getBoundingClientRect()
		const x = e.clientX - rect.left
		const y = e.clientY - rect.top
		const cx = rect.width / 2
		const cy = rect.height / 2
		const dx = x - cx
		const dy = y - cy
		let kx = Infinity
		let ky = Infinity
		if (dx !== 0) kx = cx / Math.abs(dx)
		if (dy !== 0) ky = cy / Math.abs(dy)
		const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1)
		let deg = 0
		if (dx !== 0 || dy !== 0) {
			deg = Math.atan2(dy, dx) * (180 / Math.PI) + 90
			if (deg < 0) deg += 360
		}
		card.style.setProperty("--edge-proximity", (edge * 100).toFixed(3))
		card.style.setProperty("--cursor-angle", `${deg.toFixed(3)}deg`)
	}, [])

	const goToHero = useCallback(() => {
		const st = scrollTriggerRef.current
		const target = st ? st.start : 0
		if (lenisRef.current) lenisRef.current.scrollTo(target, { duration: 1.2 })
		else window.scrollTo({ top: target, behavior: "smooth" })
	}, [])

	const goToProjects = useCallback(() => {
		const st = scrollTriggerRef.current
		const target = st ? st.end : 0
		if (lenisRef.current) lenisRef.current.scrollTo(target, { duration: 1.4 })
		else window.scrollTo({ top: target, behavior: "smooth" })
	}, [])

	const scrollToTop = useCallback(() => {
		if (lenisRef.current) lenisRef.current.scrollTo(0, { duration: 1.2 })
		else window.scrollTo({ top: 0, behavior: "smooth" })
	}, [])

	const scrollToBottom = useCallback(() => {
		const max = document.documentElement.scrollHeight - window.innerHeight
		if (lenisRef.current) lenisRef.current.scrollTo(max, { duration: 1.4 })
		else window.scrollTo({ top: max, behavior: "smooth" })
	}, [])

	const toggleTheme = useCallback(() => {
		setThemed((v) => {
			try {
				localStorage.setItem("theme", v ? "default" : "hershey")
			} catch { /* localStorage unavailable */ }
			return !v
		})
	}, [])

	return (
		<div className={`${styles["hero-root"]}${themed ? ` ${styles["theme-hershey"]}` : ""}`} ref={rootRef}>
			<div className={`${styles["bg-wash"]}`} aria-hidden="true" />
			{withCurtain && <div className={`${styles["hero-curtain"]}`} />}

			<nav className={`${styles["hero-nav"]}`}>
				<div className={`${styles["nav-inner"]}`}>
					<div className={`${styles["nav-left"]}`}>
						<button className={`${styles["nav-btn"]}`} data-cursor="glow" onClick={goToHero}>Home</button>
						<button className={`${styles["nav-btn"]}`} data-cursor="glow" onClick={goToProjects}>Projects</button>
					</div>
					<div className={`${styles["nav-brand"]}`}>Noman</div>
					<div className={`${styles["nav-right"]}`}>
						<button className={`${styles["nav-btn"]}`} data-cursor="glow" onClick={scrollToTop}>About Me</button>
						<button className={`${styles["nav-btn"]}`} data-cursor="glow" onClick={scrollToBottom}>Contact Me</button>
						<label className={`${styles["switch-button"]}`} aria-label="Toggle theme" data-cursor="glow">
							<div className={`${styles["switch-outer"]}`}>
								<input type="checkbox" checked={themed} onChange={toggleTheme} />
								<div className={`${styles["button"]}`}>
									<span className={`${styles["button-toggle"]}`} />
									<span className={`${styles["button-indicator"]}`} />
								</div>
							</div>
						</label>
					</div>
				</div>
			</nav>

			<div className={`${styles["scroll-stage"]}`}>
				<section className={`${styles["hero-sec"]}`}>
					<div className={`${styles["glass-card"]} ${styles["hero-card"]} ${styles["glow-card"]}`} ref={heroCardRef} onPointerMove={handleCardGlow}>
						<span className={`${styles["glow-edge"]}`} aria-hidden="true" />
						<div className={`${styles["hero-inner"]}`}>
							<div className={`${styles["hero-text"]}`}>
								<div className={`${styles["hero-name"]} ${styles["hero-line"]}${liquidOn ? ` ${styles["is-liquid"]}` : ""}`} ref={nameRef}>
									{NAME_WORDS.map((word, wi) => (
										<span className={`${styles["h-word"]}`} key={wi}>
											{word.split("").map((c, ci) => (
												<span className={`${styles["h-char"]}`} key={ci}>{c}</span>
											))}
										</span>
									))}
									<LiquidName
										words={NAME_WORDS}
										fontFamily="Maves, Raleway, sans-serif"
										color={themed ? "#f5ecdd" : "#1c333d"}
										onActivate={activateLiquid}
									/>
								</div>
								<div className={`${styles["hero-roles"]} ${styles["hero-line"]}`}>{splitChars(ROLES, styles["t-char"] as string)}</div>
							</div>
							<div className={`${styles["hero-aside"]} ${styles["hero-line"]}`}>
								<div className={`${styles["hero-avatar"]}`}>
									<PhotoAvatar />
								</div>
							</div>
						</div>
						<div className={`${styles["hero-corner"]} ${styles["hero-corner-l"]}`}>// COMPILING DREAMS</div>
						<div className={`${styles["hero-corner"]} ${styles["hero-corner-r"]}`}>0xNOMAN · WAGMI</div>
					</div>
				</section>

				<section className={`${styles["proj-sec"]}`}>
					<div className={`${styles["glass-card"]} ${styles["proj-card"]} ${styles["glow-card"]}`} onPointerMove={handleCardGlow}>
						<span className={`${styles["glow-edge"]}`} aria-hidden="true" />
						<div className={`${styles["proj-title"]}`}>Projects</div>
						<div className={`${styles["proj-grid"]}`}>
							{PROJECTS.map((p, i) => (
								<div className={`${styles["proj-pallet"]}`} key={i} data-cursor="glow">
									<div className={`${styles["pp-index"]} ${styles["pp-reveal"]}`}>PROJECT {p.index}</div>
									<div className={`${styles["pp-thumb"]} ${styles["pp-reveal"]}`} />
									<div className={`${styles["pp-name"]} ${styles["pp-reveal"]}`}>{p.name}</div>
									<div className={`${styles["pp-role"]} ${styles["pp-reveal"]}`}>{p.role}</div>
									<div className={`${styles["pp-desc"]} ${styles["pp-reveal"]}`}>{p.desc}</div>
									<div className={`${styles["pp-tags"]} ${styles["pp-reveal"]}`}>
										{p.tags.map((tg, j) => (
											<span className={`${styles["pp-tag"]}`} key={j}>{tg}</span>
										))}
									</div>
								</div>
							))}
						</div>
					</div>
				</section>
			</div>

			<Cursor />
		</div>
	)
}