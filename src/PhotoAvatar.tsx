import { useEffect, useRef } from "react"
import avatarSrc from "./avatar.png"

/**
 * PhotoAvatar — background-removed grayscale portrait with a gentle
 * watery "drift" warp on hover (SVG turbulence + displacement map).
 * Drop a new cut-out into src/avatar.png to swap the image.
 */

const FILTER_ID = "photo-drift-filter"

type PhotoAvatarProps = {
	maxDrift?: number
}

export default function PhotoAvatar({ maxDrift = 6 }: PhotoAvatarProps) {
	const imgRef = useRef<HTMLImageElement | null>(null)
	const dispRef = useRef<SVGFEDisplacementMapElement | null>(null)
	const rafRef = useRef<number | null>(null)
	const curRef = useRef(0)
	const targetRef = useRef(0)

	useEffect(() => {
		const disp = dispRef.current
		if (!disp) return

		const tick = () => {
			const cur = curRef.current
			const target = targetRef.current
			const next = cur + (target - cur) * 0.08
			curRef.current = next
			disp.setAttribute("scale", String(next))
			if (Math.abs(target - next) > 0.01) {
				rafRef.current = requestAnimationFrame(tick)
			} else {
				disp.setAttribute("scale", String(target))
				rafRef.current = null
			}
		}
		const startLoop = () => {
			if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick)
		}
		const handleEnter = () => {
			targetRef.current = maxDrift
			startLoop()
		}
		const handleLeave = () => {
			targetRef.current = 0
			startLoop()
		}

		const img = imgRef.current
		if (img) {
			img.addEventListener("pointerenter", handleEnter)
			img.addEventListener("pointerleave", handleLeave)
		}
		return () => {
			if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
			if (img) {
				img.removeEventListener("pointerenter", handleEnter)
				img.removeEventListener("pointerleave", handleLeave)
			}
		}
	}, [maxDrift])

	return (
		<div className="photo-avatar-wrap">
			<svg className="photo-avatar-svg" aria-hidden="true">
				<defs>
					<filter id={FILTER_ID} x="-20%" y="-20%" width="140%" height="140%">
						<feTurbulence
							type="fractalNoise"
							baseFrequency="0.008 0.012"
							numOctaves={2}
							seed={7}
							result="noise"
						>
							<animate
								attributeName="baseFrequency"
								dur="18s"
								values="0.008 0.012;0.011 0.009;0.008 0.012"
								repeatCount="indefinite"
							/>
						</feTurbulence>
						<feDisplacementMap
							ref={dispRef}
							in="SourceGraphic"
							in2="noise"
							scale={0}
							xChannelSelector="R"
							yChannelSelector="G"
						/>
					</filter>
				</defs>
			</svg>
			<img
				ref={imgRef}
				className="photo-avatar-img"
				src={avatarSrc}
				alt="Muhammad Noman"
				draggable={false}
			/>
		</div>
	)
}
