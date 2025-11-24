import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

// --- CONSTANTS & THEME ---
const THEME = {
  bg: '#000000',
  acid: '#CCFF00',    // Acid Green (装饰/强调/序号)
  silicon: '#B4C5E4', // Ice Steel (硅基数据)
  carbon: '#FF4D00',  // Neon Orange (碳基数据)
  grid: '#222222',
  text: '#9CA3AF',    // gray-400
};

// --- INLINE ICONS ---
const Icons = {
  Cpu: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
      <path d="M9 9h6v6H9z"></path>
      <path d="M9 1V4 M15 1V4 M9 20V23 M15 20V23 M20 9H23 M20 14H23 M1 9H4 M1 14H4"></path>
    </svg>
  ),
  Activity: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </svg>
  ),
};

// --- ACADEMIC SECTION ---
const AcademicSection = ({ number, title, children }) => (
  <div className="py-12 border-t border-[#333] flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
    <div className="flex flex-col gap-1">
      {/* 保持序号颜色为钢蓝色 (Ice Steel) */}
      <span className="font-mono text-sm tracking-widest" style={{ color: THEME.silicon }}>
        /{number}
      </span>
      <h3 className="text-2xl md:text-3xl text-white font-bold tracking-tight font-sans">
        {title}
      </h3>
    </div>
    <div className="text-gray-400 font-mono text-base md:text-lg leading-loose tracking-wide text-justify max-w-4xl">
        {children}
    </div>
  </div>
);

// --- SILICON MONITOR (LEFT) ---
const SiliconMonitor = () => {
  const progress = useMotionValue(0);

  const activeStep = useTransform(progress, (t) => (t > 0.25 && t < 0.75 ? 1 : 0));

  const [displayStep, setDisplayStep] = useState(0);

  useEffect(() => {
    const unsubscribe = activeStep.on("change", (latest) => {
      setDisplayStep(latest);
    });
    return () => unsubscribe();
  }, [activeStep]);

  const pathData = "M 0 150 L 100 150 L 100 50 L 300 50 L 300 150 L 400 150";

  return (
    <div className="relative h-72 border border-[#333] flex flex-col bg-black">
      <div className="border-b border-[#333] p-3 flex justify-between items-center">
        <div className="flex items-center gap-2 text-[#B4C5E4]">
          <Icons.Cpu />
          <span className="text-[10px] font-bold tracking-[0.2em] font-mono">SILICON</span>
        </div>
        <div className="text-[10px] text-gray-600 font-mono tracking-widest">DISCRETE</div>
      </div>

      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        <div className="absolute top-3 left-3 font-mono text-[10px] text-[#B4C5E4] space-y-1 z-10">
          <div>STATE: {displayStep}</div>
          <div>TYPE: BINARY</div>
        </div>

        <svg viewBox="0 0 400 200" className="w-full h-full p-4">
          <line x1="0" y1="150" x2="400" y2="150" stroke="#222" strokeWidth="1" />
          <line x1="0" y1="50" x2="400" y2="50" stroke="#222" strokeWidth="1" strokeDasharray="4 4" />
          <path d={pathData} fill="none" stroke={THEME.silicon} strokeWidth="1" opacity="0.3" />

          <motion.path
            d={pathData}
            fill="none"
            stroke={THEME.silicon}
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: [0, 1] }}
            onUpdate={(latest) => progress.set(latest.pathLength)}
            style={{ willChange: "stroke-dashoffset" }}
            transition={{
              duration: 2,
              ease: "linear",
              repeat: Infinity,
              repeatDelay: 0.5
            }}
          />

          <motion.circle
            r="3" fill={THEME.silicon} initial={{ "--offset": "0%" }} animate={{ "--offset": "100%" }}
            style={{ offsetPath: `path('${pathData}')`, offsetDistance: "var(--offset)" }}
            transition={{ duration: 2, ease: "linear", repeat: Infinity, repeatDelay: 0.5 }}
          />
        </svg>

        <div className="absolute bottom-3 right-3 flex gap-1 font-mono">
          <motion.div
            className="w-5 h-5 border border-[#333] flex items-center justify-center text-[9px]"
            style={{
              backgroundColor: useTransform(activeStep, s => s === 0 ? '#222' : 'transparent'),
              color: useTransform(activeStep, s => s === 0 ? '#ffffff' : '#444444')
            }}
          >0</motion.div>
          <motion.div
            className="w-5 h-5 border border-[#333] flex items-center justify-center text-[9px]"
            style={{
              backgroundColor: useTransform(activeStep, s => s === 1 ? THEME.silicon : 'transparent'),
              color: useTransform(activeStep, s => s === 1 ? '#000000' : '#444444')
            }}
          >1</motion.div>
        </div>
      </div>
    </div>
  );
};

const CarbonMonitor = () => {
  const progress = useMotionValue(0);

  useEffect(() => {
    // 使用关键帧 [0, 1] 确保循环正确重置
    const controls = animate(progress, [0, 1], {
      duration: 2.5,
      ease: "linear",
      repeat: Infinity,
      repeatDelay: 0.5,
      repeatType: "loop"
    });
    return () => controls.stop();
  }, []);

  // 路径几何
  const pathData = "M 0 150 Q 200 150 270 80 L 285 30 Q 290 10 295 30 L 310 150 L 400 150";

  // 状态阈值计算 (SPIKE 区间)
  const isSpike = useTransform(progress, (v) => (v > 0.71 && v < 0.79) ? 1 : 0);
  const isNotSpike = useTransform(progress, (v) => (v > 0.71 && v < 0.79) ? 0 : 1);

  // 衍生透明度控制
  const flashOpacity = useTransform(isSpike, v => v * 0.1);

  // [修复关键点] 将 MotionValue 转换为 CSS 变量所需的字符串格式
  const offsetVariable = useTransform(progress, v => `${v * 100}%`);

  return (
    <div className="relative h-72 border border-[#333] flex flex-col bg-black">
      {/* 背景闪烁 */}
      <motion.div
        className="absolute inset-0 pointer-events-none bg-[#FF4D00]"
        style={{ opacity: flashOpacity }}
      />

      <div className="border-b border-[#333] p-3 flex justify-between items-center">
        <div className="flex items-center gap-2 text-[#FF4D00]">
          <Icons.Activity />
          <span className="text-[10px] font-bold tracking-[0.2em] font-mono">CARBON</span>
        </div>
        <div className="text-[10px] text-gray-600 font-mono tracking-widest">CONTINUOUS</div>
      </div>

      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {/* 状态文字切换 */}
        <div className="absolute top-3 left-3 font-mono text-[10px] text-[#FF4D00] space-y-1 z-10">
          <div className="relative">
            <span className="opacity-50 mr-2">V:</span>
            <motion.span className="absolute left-4 top-0" style={{ opacity: isNotSpike }}>
              ACCUM
            </motion.span>
            <motion.span
              className="absolute left-4 top-0 font-bold text-[#FF4D00]"
              style={{ opacity: isSpike, textShadow: "0 0 5px #FF4D00" }}
            >
              SPIKE
            </motion.span>
          </div>
          <div className="mt-4">TYPE: ANALOG</div>
        </div>

        <svg viewBox="0 0 400 200" className="w-full h-full p-4">
          <line
            x1="0" y1="80" x2="400" y2="80"
            stroke="#FF4D00" strokeWidth="1" strokeDasharray="4 4" opacity="0.4"
          />

          {/* 静态背景轨迹 */}
          <path d={pathData} fill="none" stroke={THEME.carbon} strokeWidth="1" opacity="0.3" />

          {/* 动态波形 */}
          <motion.path
            d={pathData}
            fill="none"
            stroke={THEME.carbon}
            strokeWidth="2"
            style={{
              strokeLinejoin: "round",
              strokeLinecap: "round",
              pathLength: progress
            }}
          />

          {/* 运动光点 */}
          <motion.circle
            r="3"
            fill={THEME.carbon}
            style={{
              // [修复] 使用 CSS 变量传递 MotionValue
              "--offset": offsetVariable,
              offsetPath: `path('${pathData}')`,
              // [修复] 引用该变量，React 不会对此产生警告
              offsetDistance: "var(--offset)"
            }}
          />
        </svg>

        {/* 底部 Loading 条 */}
        <div className="absolute bottom-3 right-3 w-20 h-1 bg-[#222]">
          <motion.div
            className="h-full bg-[#FF4D00]"
            animate={{ width: ["0%", "100%", "0%"] }}
            transition={{ duration: 2.5, times: [0, 0.75, 1], repeat: Infinity, repeatDelay: 0.5, ease: "linear" }}
          />
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
const GreatDivideScene = () => {
  return (
    <div className="w-full flex flex-col mt-20">

      {/* 1. Header Section */}
      <div className="w-full max-w-[95vw] mx-auto mb-16 px-6">
        <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter text-white mb-6">
          The Great Divide
        </h2>
        <div className={`flex flex-col md:flex-row gap-8 border-l-2 border-[${THEME.acid}] pl-6`}>
          <p className="font-mono text-base md:text-lg text-gray-300 max-w-xl leading-relaxed">
            We call them both "neurons", but this is a linguistic accident, not a mathematical truth.
            <br /><br />
            <strong className="text-white">Artificial Intelligence</strong> relies on linear algebra and functions.
            <strong className="text-white"> Biological Intelligence</strong> relies on dynamical systems and differential equations.
          </p>
        </div>
      </div>

      {/* 2. Visual Section */}
      <div className="w-full bg-black border-y border-white/10 py-16">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <SiliconMonitor />
          <CarbonMonitor />
        </div>
      </div>

      {/* 3. Academic Content Section */}
      <div className="w-full bg-[#050505] border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-12">

          <AcademicSection number="01" title="Synchronous vs. Asynchronous">
            <p>
              <strong style={{ color: THEME.silicon }}>Silicon (Left):</strong> Artificial Neurons live in discrete time. They are governed by a global clock cycle (e.g., 4GHz). The entire system marches in lockstep. Between ticks, time does not exist for the model.
            </p>
            <p className="mt-4">
              <strong style={{ color: THEME.carbon }}>Carbon (Right):</strong> Biological Neurons act in continuous, real time. There is no clock. A neuron fires (spikes) only when it accumulates enough potential. It is an asynchronous, event-driven system where the precise <em>timing</em> of a spike carries information.
            </p>
          </AcademicSection>

          <AcademicSection number="02" title="The Energy Efficiency Gap">
            <p>
              Modern LLMs rely on <strong>Dense Matrix Multiplication</strong>. Every weight is multiplied by every input, even if the input is zero. This brute-force math requires megawatts of power (enough for a small city).
            </p>
            <p className="mt-4">
              The Brain is <strong>Sparse</strong>. Only a tiny fraction of neurons fire at any given moment. If nothing is happening, the brain consumes minimal energy. This sparsity allows the human brain to operate on ~20 Watts (less than a lightbulb) while outperforming supercomputers in generalization.
            </p>
          </AcademicSection>

          <AcademicSection number="03" title="Global vs. Local Learning">
            <p>
              Artificial Networks learn via <strong>Backpropagation</strong>. This requires a global error signal to be transmitted backwards through every layer, mathematically calculating the chain rule for millions of parameters.
            </p>
            <p className="mt-4">
              Biological neurons cannot transmit signals backwards. They learn via <strong>Hebbian Plasticity</strong>: "Cells that fire together, wire together." Learning happens locally at the synapse, based only on the activity of the two connected cells. Intelligence emerges from local rules, without a central optimizer.
            </p>
          </AcademicSection>

        </div>
      </div>
    </div>
  );
};

export default GreatDivideScene;