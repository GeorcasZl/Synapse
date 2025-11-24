import React, { useState, useEffect, Suspense, lazy } from 'react';
import { ReactLenis, useLenis } from '@studio-freight/react-lenis';
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from 'framer-motion';
import useStore from './store';

// Components - Eager Load (首屏核心组件)
import SingularityScene from './chapters/SingularityScene';
import Cursor from './components/Cursor';
import Button, { ScrambleText } from './components/Button';

// Components - Lazy Load (滚动后加载的组件)
// 使用 webpackChunkName 注释有助于调试，但在 Vite 中也会自动分包
const PerceptronScene = lazy(() => import('./chapters/PerceptronScene'));
const GradientDescentScene = lazy(() => import('./chapters/GradientDescentScene'));
const AttentionScene = lazy(() => import('./chapters/AttentionScene'));
const GreatDivideScene = lazy(() => import('./chapters/GreatDivideScene'));

// --- Loading Placeholder (极简加载占位符) ---
const SceneLoader = ({ label }) => (
	<div className="w-full h-full flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm border-y border-white/5">
		<div className="flex items-center gap-3">
			<div className="w-2 h-2 bg-[#CCFF00] animate-pulse" />
			<span className="font-mono text-xs text-[#CCFF00] tracking-[0.2em] animate-pulse">
				Loading {label}...
			</span>
		</div>
	</div>
);

// ... (MenuItem, NavMenu 保持不变)
const MenuItem = ({ chap, onClick }) => {
	const [isHovered, setIsHovered] = useState(false);
	return (
		<motion.div
			initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
			className="group cursor-pointer"
			onClick={onClick}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<div className="font-mono text-xs text-[#E0E0E0]/40 mb-2 group-hover:text-[#CCFF00] transition-colors">{chap.label}</div>
			<div className="text-4xl md:text-6xl font-black text-[#E0E0E0] group-hover:translate-x-4 transition-transform duration-500 uppercase tracking-tighter">
				<ScrambleText text={chap.title} trigger={isHovered} />
			</div>
		</motion.div>
	);
}

const NavMenu = ({ isOpen, onClose }) => {
	const lenis = useLenis();
	const chapters = [
		{ id: 'chapter-0', label: '00 // ORIGIN', title: 'THE SINGULARITY' },
		{ id: 'chapter-1', label: '01 // SEPARATION', title: 'THE PERCEPTRON' },
		{ id: 'chapter-2', label: '02 // OPTIMIZATION', title: 'GRADIENT DESCENT' },
		{ id: 'chapter-3', label: '03 // CONTEXT', title: 'SELF ATTENTION' },
		{ id: 'chapter-4', label: '04 // DYNAMICS', title: 'THE GREAT DIVIDE' },
	];

	const handleNav = (id) => {
		onClose();
		if (lenis) lenis.scrollTo(`#${id}`, { duration: 2 });
	};
	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					initial={{ opacity: 0, y: '-100%' }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: '-100%' }}
					transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
					className="fixed inset-0 z-[60] bg-[#050505] flex flex-col justify-center px-10 md:px-20"
				>
					<div className="absolute top-0 left-0 w-full p-8 flex justify-between items-center border-b border-[#E0E0E0]/10">
						<span className="font-mono text-xs text-[#CCFF00]">NAVIGATION_SYSTEM</span>
						<Button onClick={onClose} className="!px-4 !py-2 text-xs">CLOSE</Button>
					</div>
					<div className="space-y-8">
						{chapters.map((chap, i) => (
							<MenuItem key={chap.id} chap={chap} onClick={() => handleNav(chap.id)} />
						))}
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
};

const ParallaxTitle = ({ text, speed = 0.5 }) => {
	const { scrollYProgress } = useScroll();
	const y = useTransform(scrollYProgress, [0, 1], [0, 200 * speed]);
	return (
		<div className="relative overflow-visible py-10 mix-blend-difference z-0 pointer-events-none select-none">
			<motion.h2 style={{ y }} className="text-[10vw] leading-[0.8] font-black uppercase tracking-tighter text-[#E0E0E0] whitespace-nowrap opacity-90">
				{text}
			</motion.h2>
		</div>
	);
};

const ProgressBar = () => {
	const { scrollYProgress } = useScroll();
	const scaleY = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
	return (
		<div className="fixed right-6 top-1/2 -translate-y-1/2 h-[40vh] flex flex-col justify-between items-center z-40 mix-blend-difference hidden md:flex">
			<span className="font-mono text-[10px] text-[#E0E0E0]">00</span>
			<div className="w-[1px] h-full bg-[#E0E0E0]/20 relative overflow-hidden">
				<motion.div style={{ scaleY, transformOrigin: "top" }} className="absolute top-0 left-0 w-full h-full bg-[#CCFF00]" />
			</div>
			<span className="font-mono text-[10px] text-[#E0E0E0]">04</span>
		</div>
	);
};

const SynapseApp = () => {
	const [scrolled, setScrolled] = useState(false);
	const [uiVisible, setUiVisible] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const [headerHover, setHeaderHover] = useState(false);

	// [新增] 用于控制 SingularityScene 是否渲染的状态
	const [renderSingularity, setRenderSingularity] = useState(true);

	const { singularityActive, setSingularityActive } = useStore();

	useEffect(() => {
		const handleScroll = () => {
			const scrollY = window.scrollY;
			const viewportHeight = window.innerHeight;

			// 保持原有的顶部导航栏变色逻辑
			setScrolled(scrollY > 20);

			// [性能优化核心]
			// 当滚动超过 1.5 倍屏幕高度时，停止渲染 SingularityScene
			// 加上 1.5 的缓冲是为了避免用户在边界反复滚动时导致组件频繁挂载/卸载
			if (scrollY > viewportHeight * 1.5) {
				setRenderSingularity(false);
			} else {
				setRenderSingularity(true);
			}
		};

		window.addEventListener('scroll', handleScroll, { passive: true });
		handleScroll();

		return () => window.removeEventListener('scroll', handleScroll);
	}, []);

	const [hasStarted, setHasStarted] = useState(false);
	const [isHolding, setIsHolding] = useState(false);

	const handleClickStart = () => { if (!singularityActive && !hasStarted) setHasStarted(true); };
	const handleMouseDown = () => { if (hasStarted && !singularityActive) setIsHolding(true); }
	const handleMouseUp = () => { setIsHolding(false); }
	const handleCompletion = () => { setSingularityActive(true); setTimeout(() => setUiVisible(true), 500); };

	return (
		<ReactLenis root>
			<style>{`
				/* Inter */
				@font-face {
					font-family: 'Inter';
					src: url('/fonts/Inter-Regular.woff2') format('woff2');
					font-weight: 400;
					font-style: normal;
					font-display: swap;
				}
				@font-face {
					font-family: 'Inter';
					src: url('/fonts/Inter-Bold.woff2') format('woff2');
					font-weight: 900;
					font-style: normal;
					font-display: swap;
				}

				/* Syncopate */
				@font-face {
					font-family: 'Syncopate';
					src: url('/fonts/Syncopate-Regular.ttf') format('ttf');
					font-weight: 400;
					font-style: normal;
					font-display: swap;
				}

				/* JetBrains Mono */
				@font-face {
					font-family: 'JetBrains Mono';
					src: url('/fonts/JetBrainsMono-Regular.woff2') format('woff2');
					font-weight: 400;
					font-style: normal;
					font-display: swap;
				}

				.font-syncopate { font-family: 'Syncopate', sans-serif; }
				body { 
					font-family: 'Inter', sans-serif; 

					-webkit-user-select: none; /* Safari / Chrome */
          -moz-user-select: none;    /* Firefox */
          -ms-user-select: none;     /* IE 10+ */
          user-select: none;         /* 标准语法 */
          
          /* 禁用 iOS 长按弹出菜单 (放大镜/复制) */
          -webkit-touch-callout: none;
				}
			`}</style>

			<div className="relative w-full min-h-[300vh] text-[#E0E0E0] font-sans selection:bg-[#CCFF00] selection:text-black overflow-x-hidden cursor-none"
				onMouseDown={handleMouseDown} onMouseUp={handleMouseUp}
			>
				<NavMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

				<div className="fixed inset-0 bg-[#000000] z-[-1]" />

				<div
					className={`fixed inset-0 z-0 transition-opacity duration-1000 ${renderSingularity ? 'opacity-100' : 'opacity-0'}`}
					// 这里的 pointer-events-none 很重要，防止卸载前的淡出过程中挡住下方交互
					style={{ pointerEvents: renderSingularity ? 'auto' : 'none' }}
				>
					{/* 只有在 renderSingularity 为 true 时，组件才会被挂载，粒子运算才会进行 */}
					{renderSingularity && (
						<SingularityScene
							ready={hasStarted}
							onComplete={handleCompletion}
							paused={!renderSingularity}
						/>
					)}
				</div>

				<Cursor />
				<div className={`transition-opacity duration-1000 ${uiVisible || singularityActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
					<ProgressBar />
				</div>

				<AnimatePresence>
					{!singularityActive && (
						<motion.div
							key="overlay-container"
							exit={{ opacity: 0, transition: { duration: 2.0, ease: "easeInOut" } }}
							className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/0 ${!hasStarted ? 'cursor-pointer pointer-events-auto' : 'pointer-events-none'}`}
							onClick={!hasStarted ? handleClickStart : undefined}
						>
							<AnimatePresence mode="wait">
								{!hasStarted ? (
									<motion.div
										key="intro"
										initial={{ opacity: 0, scale: 0.95 }}
										animate={{ opacity: 1, scale: 1 }}
										exit={{ opacity: 0, y: -30, filter: "blur(10px)", transition: { duration: 0.8 } }}
										transition={{ duration: 1.5 }}
										className="text-center px-6 relative z-10"
									>
										<h2 className="text-5xl md:text-8xl font-syncopate font-normal tracking-[0.1em] leading-[1.1] mb-8 mix-blend-difference bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
											BEFORE<br />
											INTELLIGENCE
										</h2>

										<p className="font-mono text-xs md:text-sm text-[#CCFF00] tracking-[0.5em] uppercase mb-12 mix-blend-difference opacity-60">
											There was Data
										</p>

										<div className="group inline-block">
											<p className="text-[10px] text-[#E0E0E0] tracking-widest group-hover:text-white transition-colors cursor-pointer animate-pulse">
												[ CLICK TO BEGIN ]
											</p>
										</div>
									</motion.div>
								) : (
									<motion.div
										key="hint"
										initial={{ opacity: 0 }} animate={{ opacity: isHolding ? 0.8 : 0.4 }}
										exit={{ opacity: 0 }}
										transition={{ duration: 0.5 }}
										className="absolute bottom-20 w-full text-center"
									>
										<p className="text-sm font-mono text-[#E0E0E0] tracking-[0.2em]">
											[ HOLD TO ORGANIZE ]
										</p>
									</motion.div>
								)}
							</AnimatePresence>
						</motion.div>
					)}
				</AnimatePresence>

				<div className={`relative z-10 transition-opacity duration-1000 ${uiVisible || singularityActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
					<header className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 border-b ${scrolled ? 'bg-black/50 backdrop-blur-xl py-4 border-[#E0E0E0]/10' : 'bg-transparent py-6 border-transparent'}`}>
						<div className="w-full max-w-[95vw] mx-auto flex justify-between items-center">
							<h1
								className="text-lg font-bold tracking-tight cursor-pointer mix-blend-difference w-32"
								onMouseEnter={() => setHeaderHover(true)}
								onMouseLeave={() => setHeaderHover(false)}
							>
								<ScrambleText text="SYNAPSE" trigger={headerHover} />
							</h1>
							<Button className="!px-4 !py-2 text-xs" onClick={() => setMenuOpen(true)}>Menu</Button>
						</div>
					</header>

					<main className="pt-32 pb-20 px-6 max-w-[95vw] mx-auto">
						<section id="chapter-0" className="min-h-[90vh] flex flex-col justify-center items-center relative mb-32 pointer-events-none">
							<AnimatePresence>
								{singularityActive && (
									<motion.div
										initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 1.5 }}
										className="mt-[20vh] text-center max-w-xl"
									>
										<div className="text-left space-y-4">
											<p className="font-mono text-sm leading-relaxed text-[#E0E0E0]">
												At the beginning, there is only Chaos.
											</p>
											<p className="font-mono text-xs leading-relaxed text-[#E0E0E0]/70">
												A neural network is not born intelligent. It initializes in a state of <strong>Maximum Entropy</strong>.
												Billions of parameters are drawn from a random probability distribution, meaning the system has no prior knowledge, no bias, and no structure.
											</p>
											<p className="font-mono text-xs leading-relaxed text-[#E0E0E0]/70">
												Intelligence is not magic; it is the result of carving a low-dimensional structure out of high-dimensional noise through the iterative force of Optimization.
											</p>
										</div>
										<motion.div
											initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.0 }}
											className="mt-12 flex justify-center"
										>
											<span className="font-mono text-[10px] text-[#CCFF00] tracking-[0.2em]">SCROLL TO EXPLORE</span>
										</motion.div>
									</motion.div>
								)}
							</AnimatePresence>
						</section>

						<section id="chapter-1" className="min-h-screen mb-32 relative flex flex-col justify-center">
							<div className="font-mono text-xs text-[#CCFF00] mb-4 ml-1 absolute top-0 left-0">[ 01 // SEPARATION ]</div>
							<Suspense fallback={<SceneLoader label="PERCEPTRON" />}>
								<PerceptronScene />
							</Suspense>
						</section>

						<section id="chapter-2" className="min-h-screen mb-32 relative flex flex-col justify-center">
							<div className="font-mono text-xs text-[#CCFF00] mb-4 ml-1 absolute top-0 left-0">[ 02 // OPTIMIZATION ]</div>
							<Suspense fallback={<SceneLoader label="GRADIENT" />}>
								<GradientDescentScene />
							</Suspense>
						</section>

						<section id="chapter-3" className="min-h-screen mb-32 relative flex flex-col justify-center">
							<div className="font-mono text-xs text-[#CCFF00] mb-4 ml-1 absolute top-0 left-0">[ 03 // CONTEXT ]</div>
							<Suspense fallback={<SceneLoader label="ATTENTION" />}>
								<AttentionScene />
							</Suspense>
						</section>

						<section id="chapter-4" className="min-h-screen mb-32 relative flex flex-col justify-center">
							<div className="font-mono text-xs text-[#CCFF00] mb-4 ml-1 absolute top-0 left-0">[ 04 // DYNAMICS ]</div>
							<Suspense fallback={<SceneLoader label="SUBSTRATE" />}>
								<GreatDivideScene />
							</Suspense>
						</section>
					</main>

					<footer className="border-t border-[#E0E0E0]/20 p-6">
						<div className="flex justify-between items-end font-mono text-[10px] uppercase opacity-50">
							<div>Synapse v1.1.0</div>
							<div className="text-right">2025</div>
						</div>
					</footer>
				</div>
			</div>
		</ReactLenis>
	);
};

export default SynapseApp;