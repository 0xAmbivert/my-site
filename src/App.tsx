import { useState } from "react"
import Preloader from "./Preloader"
import Hero from "./Hero"

/**
 * Merged experience (overlay architecture).
 *
 * WHY THE WRAPPERS MATTER:
 * Hero and Preloader render into the SAME document, so their z-index values
 * compete on one global scale. Hero's full-screen curtain sits at z-index 60
 * and its navbar at 30, while the Preloader's opaque background is only at
 * z-index 10. Without isolation, Hero's gold curtain paints ON TOP of the
 * Preloader: it tints everything, lets the navbar/ENTER bleed through, blocks
 * the ENTER click, and shows the native cursor.
 *
 * FIX: give each component its own stacking context (isolation:isolate). The
 * Preloader wrapper sits at a very high z-index so the ENTIRE Preloader (incl.
 * its opaque background + its own cursor) is above the ENTIRE Hero. When the
 * preloader's curtain has fully expanded + cross-graded to the hero color it
 * fires `onCurtainFull`; we then start Hero (its same-color curtain takes over
 * seamlessly) and unmount the preloader on the next frame.
 *
 * Requires: npm i gsap
 * If you are on Next.js App Router, add "use client" at the very top of this file.
 */

const heroLayer = {
	position: "relative",
	zIndex: 0,
	isolation: "isolate",
} as const

const preloaderLayer = {
	position: "fixed",
	top: 0,
	left: 0,
	width: "100%",
	height: "100%",
	zIndex: 9999,
	isolation: "isolate",
} as const

export default function App() {
	const [entered, setEntered] = useState(false)
	const [showPreloader, setShowPreloader] = useState(true)

	return (
		<>
			<div style={heroLayer}>
				<Hero start={entered} withCurtain />
			</div>
			{showPreloader && (
				<div style={preloaderLayer}>
					<Preloader
						name="Noman"
						holdCurtain
						onCurtainFull={() => {
							setEntered(true)
							requestAnimationFrame(() => setShowPreloader(false))
						}}
					/>
				</div>
			)}
		</>
	)
}
