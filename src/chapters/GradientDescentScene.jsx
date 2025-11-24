import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrthographicCamera, Preload } from '@react-three/drei';
import * as THREE from 'three';
import Button from '../components/Button';

// --- THEME & CONSTANTS ---
const THEME = {
    acid: '#CCFF00',
    orange: '#FF4D00',
    steel: '#B4C5E4',
    white: '#E0E0E0',
    panel: "bg-black/80 backdrop-blur-md border border-white/10 p-6 font-mono text-[#E0E0E0] z-20",
};

const generateCoefficients = () => {
    return { a: 0.03 + Math.random() * 0.05, b: -0.2 - Math.random() * 0.5, c: (Math.random() - 0.5) * 0.5, d: 1 };
};

// --- SIMULATION COMPONENT (OPTIMIZED) ---
const Simulation = ({ isPlaying, paramsRef, statsRef, onStatusChange, coefficients, seed }) => {
    const ballRef = useRef();
    const tangentRef = useRef();
    const state = useRef({ x: -3, vx: 0, epoch: 0, timer: 0 });

    // [优化] DOM 更新节流计数器
    const frameCountRef = useRef(0);

    // [优化] 预先分配切线的顶点数据数组 (Float32Array)，避免每帧 new
    // 2个点 * 3个坐标(x,y,z) = 6
    const tangentPositions = useMemo(() => new Float32Array(6), []);

    useEffect(() => {
        state.current.x = (Math.random() > 0.5 ? -3.0 : 3.0) + (Math.random() - 0.5);
        state.current.vx = 0; state.current.epoch = 0; state.current.timer = 0;
        onStatusChange("READY");
    }, [seed, onStatusChange]);

    const f = (x) => { const { a, b, c, d } = coefficients; return a * Math.pow(x, 4) + b * Math.pow(x, 2) + c * x + d; };
    const df = (x) => { const { a, b, c } = coefficients; return 4 * a * Math.pow(x, 3) + 2 * b * x + c; };

    const curvePoints = useMemo(() => {
        const points = [];
        for (let x = -6; x <= 6; x += 0.1) points.push(new THREE.Vector3(x, f(x), 0));
        return points;
    }, [coefficients]);

    useFrame((_, delta) => {
        const p = state.current;
        const currentY = f(p.x);
        const currentGrad = df(p.x);

        // 物理更新逻辑
        if (isPlaying) {
            p.timer += delta;
            if (p.timer > 0.02) {
                p.timer = 0;
                const { learningRate, momentum } = paramsRef.current;
                p.vx = (p.vx * momentum) - (currentGrad * learningRate);
                p.x += p.vx;
                p.epoch++;
                if (Math.abs(p.x) > 8 || isNaN(p.x)) {
                    onStatusChange("DIVERGED (RESET)"); p.x = (Math.random() > 0.5 ? -3 : 3); p.vx = 0;
                } else if (Math.abs(currentGrad) < 0.001 && Math.abs(p.vx) < 0.001) {
                    onStatusChange("CONVERGED");
                } else { onStatusChange("TRAINING..."); }
            }
        }

        // 1. 更新球体位置
        if (ballRef.current) ballRef.current.position.set(p.x, currentY, 0.1);

        // 2. 更新切线 (零 GC 方式)
        if (tangentRef.current) {
            const slope = currentGrad;
            const dx = 0.8;
            const dy = slope * dx;

            // 直接修改预分配数组的值，而不是创建新数组
            tangentPositions[0] = p.x - dx; // x1
            tangentPositions[1] = f(p.x) - dy; // y1
            tangentPositions[2] = 0;        // z1

            tangentPositions[3] = p.x + dx; // x2
            tangentPositions[4] = f(p.x) + dy; // y2
            tangentPositions[5] = 0;        // z2

            // 标记 Buffer 需要上传到 GPU
            tangentRef.current.geometry.attributes.position.needsUpdate = true;
        }

        // 3. DOM 更新节流 (每 5 帧更新一次 HTML)
        frameCountRef.current++;
        if (statsRef.current && frameCountRef.current % 5 === 0) {
            statsRef.current.innerHTML = `
            <div class="flex flex-col gap-1 text-xs font-mono text-gray-400">
                <div class="flex justify-between"><span class="text-white">LOSS f(x)</span> <span>${currentY.toFixed(4)}</span></div>
                <div class="flex justify-between"><span style="color: ${THEME.orange}">GRADIENT</span> <span>${currentGrad.toFixed(4)}</span></div>
                <div class="flex justify-between border-t border-white/10 pt-1 mt-1"><span>EPOCH</span> <span class="text-white">${p.epoch}</span></div>
            </div>
        `;
        }
    });

    return (
        <>
            {/* 背景坐标轴线 */}
            <line>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" count={2} array={new Float32Array([-10, 0, 0, 10, 0, 0])} itemSize={3} />
                </bufferGeometry>
                <lineBasicMaterial color="#333" />
            </line>

            {/* 损失函数曲线 */}
            <Line points={curvePoints} color="white" lineWidth={2} opacity={0.8} transparent />

            {/* [修复] 恢复球体 Mesh */}
            <group ref={ballRef} position={[-3, 0, 0.1]}>
                {/* 实心核 */}
                <mesh>
                    <circleGeometry args={[0.15, 32]} />
                    <meshBasicMaterial color={THEME.acid} toneMapped={false} />
                </mesh>
                {/* 外部光晕 */}
                <mesh>
                    <circleGeometry args={[0.5, 32]} />
                    <meshBasicMaterial color={THEME.acid} transparent opacity={0.3} toneMapped={false} />
                </mesh>
            </group>

            {/* 优化的切线 */}
            <line ref={tangentRef}>
                <bufferGeometry>
                    {/* 绑定预分配的 Float32Array */}
                    <bufferAttribute
                        attach="attributes-position"
                        count={2}
                        array={tangentPositions}
                        itemSize={3}
                    />
                </bufferGeometry>
                <lineBasicMaterial color={THEME.orange} linewidth={2} toneMapped={false} />
            </line>
        </>
    );
};

// --- ACADEMIC SECTION ---
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

// --- MAIN SCENE COMPONENT ---
const GradientDescentScene = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [status, setStatus] = useState("READY");
    const [seed, setSeed] = useState(0);
    const coefficients = useMemo(() => generateCoefficients(), [seed]);
    const paramsRef = useRef({ learningRate: 0.01, momentum: 0.5 });
    const statsRef = useRef(null);
    const [uiLR, setUiLR] = useState(0.01);
    const [uiMom, setUiMom] = useState(0.5);

    const handleLR = (e) => { const v = parseFloat(e.target.value); setUiLR(v); paramsRef.current.learningRate = v; };
    const handleMom = (e) => { const v = parseFloat(e.target.value); setUiMom(v); paramsRef.current.momentum = v; };
    const togglePlay = () => setIsPlaying(!isPlaying);
    const handleReset = () => { setIsPlaying(false); setSeed(s => s + 1); };

    return (
        <div className="w-full flex flex-col mt-20">
            <div className="w-full max-w-[95vw] mx-auto mb-12 px-6">
                <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter text-white mb-6">Gradient Descent</h2>
                <div className="flex flex-col md:flex-row gap-8 border-l-2 border-[#CCFF00] pl-6">
                    <p className="font-mono text-base md:text-lg text-gray-300 max-w-2xl leading-relaxed">
                        Optimization is the engine of intelligence.
                        <br /><br />
                        Mathematically, training a neural network is equivalent to finding the global minimum of a non-convex function in a high-dimensional space.
                    </p>
                </div>
            </div>

            <div className="w-full relative h-[80vh] bg-black border-y border-white/10">
                <Canvas className="absolute inset-0 z-0">
                    <color attach="background" args={['#000000']} />
                    <OrthographicCamera makeDefault position={[0, 2, 10]} zoom={50} />
                    <Simulation isPlaying={isPlaying} paramsRef={paramsRef} statsRef={statsRef} onStatusChange={setStatus} coefficients={coefficients} seed={seed} />
                    <Preload all />
                </Canvas>

                <div className="absolute top-6 left-6 z-20 pointer-events-none">
                    <div className="bg-black/50 backdrop-blur border border-white/10 p-4 w-64">
                        <div className={`text-[${THEME.steel}] text-[10px] tracking-widest mb-2`}>SIMULATION_METRICS</div>
                        <div ref={statsRef}>Calculating...</div>
                        <div className="mt-4 pt-2 border-t border-white/10 flex justify-between">
                            <span className="text-xs text-gray-500">STATUS</span>
                            <span className={`text-xs font-bold tracking-widest ${status === 'CONVERGED' ? 'text-[#CCFF00]' : 'text-white'}`}>{status}</span>
                        </div>
                    </div>
                </div>
                <div className={`absolute bottom-6 left-6 w-80 ${THEME.panel}`}>
                    <div className={`text-[${THEME.steel}] text-[10px] tracking-widest mb-4 border-b border-white/10 pb-2`}>HYPERPARAMETERS</div>
                    <div className="space-y-5">
                        <div><div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>LEARNING RATE</span><span className="text-white">{uiLR.toFixed(3)}</span></div><input type="range" min="0.001" max="1.2" step="0.001" value={uiLR} onChange={handleLR} className="custom-range" /></div>
                        <div><div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>MOMENTUM</span><span className="text-white">{uiMom.toFixed(2)}</span></div><input type="range" min="0.0" max="0.98" step="0.01" value={uiMom} onChange={handleMom} className="custom-range" /></div>
                    </div>
                    <div className="flex gap-4 mt-6">
                        <Button onClick={togglePlay} className={`flex-1 ${isPlaying ? `border-[${THEME.orange}] text-[${THEME.orange}]` : 'border-[#CCFF00] text-[#CCFF00]'}`}>{isPlaying ? 'PAUSE' : 'START'}</Button>
                        <Button onClick={handleReset} className="flex-1 text-xs">NEW GRAPH</Button>
                    </div>
                </div>
            </div>

            <div className="w-full bg-[#050505] border-b border-white/10">
                <div className="max-w-5xl mx-auto px-6 md:px-12 py-12">
                    <AcademicSection number="01" title="The Loss Manifold">
                        <p>
                            Imagine a mountain range where "Height" equals "Error". Your goal is to find the deepest valley (Global Minimum).
                        </p>
                        <p className="mt-4">
                            The curve you see is the <strong>Loss Function</strong> $J(\theta)$. It maps the model's parameters (x-axis) to its performance error (y-axis).
                            In reality, this isn't a 2D line, but a chaotic, non-convex surface in millions of dimensions. We call this the <strong>Optimization Landscape</strong>.
                        </p>
                    </AcademicSection>

                    <AcademicSection number="02" title="The Gradient Vector">
                        <p>
                            The machine is blind; it cannot see the valley. It can only feel the slope under its feet.
                        </p>
                        <p className="mt-4">
                            The <strong>Gradient</strong> ∇J(θ) is a vector pointing up the steepest slope. To minimize error, we calculate this derivative and take a step in the <em>opposite</em> direction:
                            <br />
                            <span className="text-white bg-white/10 px-2 py-1 font-mono mt-2 inline-block rounded">
                                θ<sub>new</sub> = θ<sub>old</sub> - η · ∇J(θ)
                            </span>
                            <br />
                            Here, η (eta) is the <strong>Learning Rate</strong>. Too small, and you never arrive. Too large, and you overshoot the target (divergence).
                        </p>
                    </AcademicSection>

                    <AcademicSection number="03" title="Momentum & Inertia">
                        <p>
                            Standard Gradient Descent (SGD) gets stuck in small potholes (Local Minima) or zig-zags in narrow ravines.
                        </p>
                        <p className="mt-4">
                            <strong>Momentum</strong> solves this by adding physics to the math. We treat the parameter like a heavy ball rolling down the hill. It accumulates velocity from past gradients. This inertia allows it to power through small bumps and flat regions (plateaus) to find the true bottom.
                        </p>
                    </AcademicSection>
                </div>
            </div>
        </div>
    );
};

export default GradientDescentScene;