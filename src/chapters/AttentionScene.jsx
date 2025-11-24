import React, { useState, useMemo, useEffect, useRef, Suspense, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, Line, Preload } from '@react-three/drei';
import * as THREE from 'three';

// --- 1. 配色保持不变 ---
const COLORS = {
	active: '#D9FF00',
	related: '#B4C5E4',
	text: '#888888',
	dim: '#222222'
};

const WORDS = [
	"THE", "NEURAL", "NETWORK", "DREAMS", "OF",
	"ELECTRIC", "SHEEP", "IN", "THE", "VOID",
	"CALCULATING", "INFINITE", "PATTERNS", "FROM", "CHAOS",
	"EMERGENCE", "SYNAPSE", "TENSOR", "FLOW", "MATRIX",
	"ATTENTION", "IS", "ALL", "YOU", "NEED",
	"TRANSFORMER", "VECTOR", "SPACE", "TOKEN", "EMBEDDING"
];

// 复用向量对象，减少 GC
const _tempVec = new THREE.Vector3();

const getFibonacciSpherePoints = (samples, radius = 4.8) => {
	const points = [];
	const phi = Math.PI * (3 - Math.sqrt(5));
	for (let i = 0; i < samples; i++) {
		const y = 1 - (i / (samples - 1)) * 2;
		const r = Math.sqrt(1 - y * y);
		const theta = phi * i;
		const x = Math.cos(theta) * r;
		const z = Math.sin(theta) * r;
		points.push(new THREE.Vector3(x * radius, y * radius, z * radius));
	}
	return points;
};

// 简单的数学计算优化
const calculateAttentionScore = (dist, temperature) => {
	const maxDist = 10;
	// 避免在热路径中使用 Math.max(0, ...) 如果确定 dist 不会太大
	const rawSim = dist > maxDist ? 0 : 1 - dist / maxDist;
	// 缓存指数计算
	const exp = 1 / (temperature * 1.2);
	let weight = Math.pow(rawSim, exp);
	return weight > 1 ? 1 : (weight < 0 ? 0 : weight);
};

const AttentionLines = React.memo(({ activeIndex, tokens, temperature }) => {
	// 性能优化：只计算需要渲染的线段数据，而不是返回组件
	// 只有当 activeIndex 或 temperature 改变时才重算
	const linesData = useMemo(() => {
		if (activeIndex === null) return [];

		const sourceToken = tokens[activeIndex];
		const validLines = [];
		const threshold = temperature > 1.0 ? 0.25 : 0.15;

		for (let i = 0; i < tokens.length; i++) {
			if (activeIndex === i) continue;
			const targetToken = tokens[i];
			const dist = sourceToken.pos.distanceTo(targetToken.pos);
			const weight = calculateAttentionScore(dist, temperature);

			if (weight > threshold) {
				validLines.push({
					start: sourceToken.pos,
					end: targetToken.pos,
					opacity: weight * 0.4,
					width: weight * 1.2
				});
			}
		}
		return validLines;
	}, [activeIndex, tokens, temperature]);

	return (
		<group>
			{linesData.map((line, i) => (
				<Line
					key={i}
					points={[line.start, line.end]}
					color={COLORS.related}
					lineWidth={line.width}
					transparent
					opacity={line.opacity}
					// 性能优化：不仅不深度写入，还设为 renderOrder 较小的值（如果需要）
					depthWrite={false}
				/>
			))}
		</group>
	);
});

// 使用 React.memo 防止父组件渲染导致 Token 重渲染（虽然 R3F 组件开销小，但积少成多）
const Token = React.memo(({
	text, position, index, isHovered, isRelated, activePos, temperature,
	onHover, onLeave
}) => {
	const groupRef = useRef();
	// 使用 useRef 存储随机相位，避免重渲染时重置动画
	const phase = useRef(Math.random() * Math.PI * 2);
	const initialY = useRef(position.y);

	useFrame((state) => {
		if (groupRef.current) {
			const t = state.clock.elapsedTime;
			// 简单的正弦波浮动
			groupRef.current.position.y = initialY.current + Math.sin(t * 0.8 + phase.current) * 0.15;
		}
	});

	// 计算样式逻辑 (纯 JS 计算非常快)
	let styleColor = COLORS.text;
	let styleScale = 1;
	let zIndex = 0;
	let opacity = 1;
	let fontWeight = 'normal';
	let scoreValue = '0.00';
	const shouldShowScore = isRelated && activePos;
	const isActiveGlobal = activePos !== null;

	if (isHovered) {
		styleColor = COLORS.active;
		styleScale = 1.4;
		zIndex = 20;
		fontWeight = 'bold';
	} else if (isRelated) {
		styleColor = COLORS.related;
		styleScale = 1.15;
		zIndex = 10;
		opacity = 0.9;
		if (activePos) {
			// 注意：position 是动态引用的，这里为了计算 score 使用初始位置还是动态位置？
			// 建议使用传入的静态 position prop 计算，避免每一帧数字都在跳变
			const dist = position.distanceTo(activePos);
			scoreValue = calculateAttentionScore(dist, temperature).toFixed(2);
		}
	} else if (isActiveGlobal) {
		styleColor = COLORS.dim;
		styleScale = 0.85;
		opacity = 0.2;
	}

	return (
		<group
			ref={groupRef}
			position={[position.x, position.y, position.z]}
			// [关键优化] 使用 R3F 事件系统代替手动 Raycaster
			onPointerOver={(e) => { e.stopPropagation(); onHover(index); }}
			onPointerOut={(e) => { e.stopPropagation(); onLeave(); }}
		>
			{/* [交互优化] 添加一个不可见的 Mesh 作为 Hitbox (碰撞箱) 
               文字本身太细，很难鼠标悬停。加一个透明球体让交互更丝滑。
            */}
			<mesh visible={false}>
				<sphereGeometry args={[0.5, 8, 8]} />
				<meshBasicMaterial />
			</mesh>

			<Html center style={{ pointerEvents: 'none' }}>
				<div
					style={{
						color: styleColor,
						transform: `scale(${styleScale})`,
						opacity: opacity,
						fontFamily: "'JetBrains Mono', monospace",
						fontWeight: fontWeight,
						fontSize: '14px',
						// ... 其他样式保持不变
						cursor: 'none',
						userSelect: 'none',
						whiteSpace: 'nowrap',
						transition: 'color 0.4s ease-out, transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s ease-out',
						padding: '8px',
						zIndex: zIndex,
						display: 'flex',
						alignItems: 'center',
					}}
				>
					{text}
					<div style={{
						display: 'flex',
						alignItems: 'center',
						marginLeft: shouldShowScore ? '8px' : '0px',
						opacity: shouldShowScore ? 1 : 0,
						transform: shouldShowScore ? 'translateX(0)' : 'translateX(-5px)',
						transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
					}}>
						<span style={{ color: COLORS.dim, marginRight: '4px', fontWeight: 'normal' }}>|</span>
						<span style={{
							fontSize: '11px',
							color: COLORS.related,
							fontWeight: 'bold',
							fontFamily: 'monospace',
							letterSpacing: '-0.5px'
						}}>
							{scoreValue}
						</span>
					</div>
				</div>
			</Html>
		</group>
	);
});

const SceneContent = ({ temperature }) => {
	const [hoveredIndex, setHoveredIndex] = useState(null);

	// 缓存 Token 数据，只计算一次
	const tokens = useMemo(() => {
		const points = getFibonacciSpherePoints(WORDS.length);
		return WORDS.map((word, i) => ({ id: i, text: word, pos: points[i] }));
	}, []);

	// 计算相关索引 Set (纯数据逻辑，不涉及渲染)
	const relatedIndices = useMemo(() => {
		if (hoveredIndex === null) return new Set();

		const sourcePos = tokens[hoveredIndex].pos;
		const newRelated = new Set();
		const threshold = temperature > 1.0 ? 0.25 : 0.15;

		tokens.forEach((targetToken, i) => {
			if (hoveredIndex === i) return;
			const dist = sourcePos.distanceTo(targetToken.pos);
			const weight = calculateAttentionScore(dist, temperature);
			if (weight > threshold) newRelated.add(i);
		});
		return newRelated;
	}, [hoveredIndex, tokens, temperature]);

	const groupRef = useRef();
	const activePos = hoveredIndex !== null ? tokens[hoveredIndex].pos : null;

	// 这里的 useFrame 只负责整体旋转，完全移除 Raycaster 逻辑
	useFrame((state, delta) => {
		if (groupRef.current && hoveredIndex === null) {
			groupRef.current.rotation.y += delta * 0.02;
		}
	});

	// 使用 useCallback 避免传递给子组件的函数引用变化
	const handleHover = useCallback((index) => setHoveredIndex(index), []);
	const handleLeave = useCallback(() => setHoveredIndex(null), []);

	return (
		<>
			<OrbitControls enableZoom={false} enablePan={false} autoRotate={false} />
			<group ref={groupRef}>
				{tokens.map((token, i) => (
					<Token
						key={i}
						index={i}
						text={token.text}
						position={token.pos}
						isHovered={hoveredIndex === i}
						isRelated={relatedIndices.has(i)}
						activePos={activePos}
						temperature={temperature}
						onHover={handleHover}
						onLeave={handleLeave}
					/>
				))}
				<AttentionLines
					activeIndex={hoveredIndex}
					tokens={tokens}
					temperature={temperature}
				/>
			</group>
		</>
	);
};

// ... AcademicSection 和 AttentionScene 保持不变 ...
// 只需确保 AttentionScene 导出即可

const AcademicSection = ({ number, title, children }) => (
	<div className="py-16 border-t border-white/10 flex flex-col gap-6">
		<div className="flex flex-col gap-2">
			<span className="font-mono text-[#B4C5E4] text-sm tracking-widest">
				/{number}
			</span>
			<h3 className="text-3xl md:text-4xl text-white font-bold tracking-tight">
				{title}
			</h3>
		</div>
		<div className="text-gray-400 font-mono text-base md:text-lg leading-loose tracking-wide text-justify max-w-4xl">
        {children}
    </div>
	</div>
);

const AttentionScene = () => {
	const [temperature, setTemperature] = useState(0.5);
	return (
		<div className="w-full flex flex-col mt-20">
			<div className="w-full max-w-[95vw] mx-auto mb-12 px-6">
				<h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter text-white mb-6">Self Attention</h2>
				<div className="flex flex-col md:flex-row gap-8 border-l-2 border-[#D9FF00] pl-6">
					<p className="font-mono text-base md:text-lg text-gray-300 max-w-xl leading-relaxed">
						Context is king.
						<br /><br />
						Words have no fixed meaning in isolation. Their meaning is derived from their relationship with every other word in the sequence.
					</p>
				</div>
			</div>

			<div className="w-full relative h-[75vh] bg-black border-y border-white/10">
				<Canvas camera={{ position: [0, 0, 20], fov: 35 }} gl={{ antialias: true, alpha: false }}>
					<color attach="background" args={['#000000']} />
					<fog attach="fog" args={['#000000', 10, 30]} />
					<Suspense fallback={null}>
						<SceneContent temperature={temperature} />
					</Suspense>
					<Preload all />
				</Canvas>

				<div className="absolute bottom-6 left-6 w-80 bg-black/80 backdrop-blur-md border border-white/10 p-6 font-mono text-[#E0E0E0] z-20">
					<div className="text-[#B4C5E4] text-[10px] tracking-widest mb-4 border-b border-white/10 pb-2">HYPERPARAMETERS</div>
					<div className="flex justify-between text-[10px] text-gray-400 mb-1">
						<span>TEMPERATURE</span><span className="text-white">{temperature.toFixed(2)}</span>
					</div>
					<input type="range" min="0.1" max="2.0" step="0.01" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} className="custom-range" />
					<div className="flex justify-between text-[8px] text-gray-600 mt-2">
						<span>PRECISE (Low)</span>
						<span>CREATIVE (High)</span>
					</div>
				</div>
			</div>

			<div className="w-full bg-[#050505] border-b border-white/10">
				<div className="max-w-5xl mx-auto px-6 md:px-12 py-12">

					<AcademicSection number="01" title="Embedding: Space of Meaning">
						<p>
							Computers cannot process raw text. Instead, each word is mapped to a dense vector <strong>v ∈ ℝ⁵¹²</strong> (where d is often 512 or larger).
						</p>
						<p className="mt-4">
							This is based on the <strong>Distributional Hypothesis</strong>: words that appear in similar contexts have similar meanings. In this geometric space, "King" is mathematically close to "Queen", and the vector direction from "Paris" to "France" is parallel to "Tokyo" to "Japan". Meaning becomes Geometry.
						</p>
					</AcademicSection>

					<AcademicSection number="02" title="The Attention Mechanism">
						<p>
							How does an LLM understand context? It uses <strong>Scaled Dot-Product Attention</strong>:
							<br />
							<span className="text-[#B4C5E4] block mt-2 p-2 bg-white/5 rounded w-fit font-mono text-xs md:text-sm">
								Attention(Q, K, V) = softmax(QKᵀ / √dₖ)V
							</span>
						</p>
						<p className="mt-4">
							Think of it as a database lookup.
							The <strong>Query (Q)</strong> is what you are looking for.
							The <strong>Key (K)</strong> is the label of the data.
							The dot product Q · K measures similarity. If they align, the model pays "attention" to the corresponding <strong>Value (V)</strong>. This allows the model to route information between distant words dynamically.
						</p>
					</AcademicSection>

					<AcademicSection number="03" title="Temperature & Entropy">
						<p>
							The <strong>Softmax</strong> function converts raw scores (logits) into probabilities. <strong>Temperature (T)</strong> is a hyperparameter that scales these logits before Softmax.
						</p>
						<p className="mt-4">
							<strong className="text-[#B4C5E4]">Low T (T → 0):</strong> Freezes the distribution. The probability concentrates on the single most likely word. The model becomes deterministic and logic-focused.
							<br />
							<strong className="text-[#FF4D00]">High T (T &gt; 1):</strong> Melts the distribution. Entropy increases, flattening the probabilities. The model takes risks, sampling less likely words, leading to "creativity" or hallucinations.
						</p>
					</AcademicSection>

				</div>
			</div>
		</div>
	);
};

export default AttentionScene;