
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Plane, Instances, Instance, Preload, Text } from '@react-three/drei';
import * as THREE from 'three';

const _tempVec = new THREE.Vector3();
const _planeNormal = new THREE.Vector3();
const _color = new THREE.Color();

const COLORS = {
  cyan: new THREE.Color('#00F0FF'),
  orange: new THREE.Color('#FF4D00'),
};

const THEME = {
  panel: "bg-black/80 backdrop-blur-md border border-white/10 p-6 font-mono text-[#E0E0E0] z-20",
  header: "text-xs font-bold text-white mb-4 pb-2 border-b border-white/10",
};

const COUNT = 150;

const generateData = () => {
  const data = [];
  const spread = 2.5;
  const centerOffset = 1.2;
  for (let i = 0; i < COUNT; i++) {
    const isClassA = i < COUNT / 2;
    const z = isClassA ? -centerOffset : centerOffset;
    const x = (Math.random() - 0.5) * spread * 2;
    const y = (Math.random() - 0.5) * spread * 2;
    const zNoise = (Math.random() - 0.5) * spread * 2;
    data.push({ position: new THREE.Vector3(x, y, z + zNoise), isClassA: isClassA, id: i });
  }
  return data;
};

const PerceptronContent = ({ pointsData, planeRef, statsRef }) => {
  const meshRef = useRef();
  // 仅保留 DOM 更新的节流计数器，因为 DOM 操作才是真正的性能瓶颈
  const frameCountRef = useRef(0);

  useFrame(() => {
    // 安全检查
    if (!meshRef.current || !planeRef.current) return;

    // --- 移除所有“脏检查”和“预热”逻辑，每帧都执行，确保画面绝对稳定 ---

    // 1. 实时计算平面法向量
    _planeNormal.set(0, 0, 1).applyEuler(planeRef.current.rotation);
    const planePos = planeRef.current.position;

    let errorCount = 0;

    // 2. 遍历所有点并更新颜色
    // 对于 150 个点，这个循环非常快，不需要优化
    pointsData.forEach((p, i) => {
      // 复用向量计算距离
      _tempVec.copy(p.position).sub(planePos);
      const dist = _tempVec.dot(_planeNormal);

      const predictedClassA = dist < 0;
      const isCorrect = predictedClassA === p.isClassA;

      if (!isCorrect) errorCount++;

      // 设置基础颜色
      if (p.isClassA) _color.set(COLORS.cyan);
      else _color.set(COLORS.orange);

      // 设置亮度（正确则亮，错误则暗）
      if (!isCorrect) _color.multiplyScalar(0.2);
      else _color.multiplyScalar(1.5);

      // 直接写入缓冲区
      meshRef.current.setColorAt(i, _color);
    });

    // 3. 强制标记更新：告诉 GPU 每一帧都要使用我们计算的颜色
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }

    // 4. DOM 更新节流 (这是唯一需要优化的部分)
    // 每 5 帧更新一次文字，避免 React 重绘导致的 UI 闪烁
    frameCountRef.current++;
    if (statsRef.current && frameCountRef.current % 5 === 0) {
      const loss = errorCount / COUNT;
      statsRef.current.innerHTML = `
          <div class="font-mono text-sm text-gray-300 flex flex-col gap-1">
            <div class="flex justify-between items-center"><span class="text-gray-500 text-xs">ERRORS</span><span class="text-white">${errorCount} <span class="text-gray-600">/ ${COUNT}</span></span></div>
            <div class="w-full h-px bg-white/10 my-2"></div>
            <div class="flex justify-between items-center"><span class="text-gray-500 text-xs">LOSS</span> <span class="text-2xl font-light text-white">${loss.toFixed(4)}</span></div>
          </div>
        `;
    }
  });

  return (
    <Instances range={COUNT} ref={meshRef}>
      <sphereGeometry args={[0.12, 16, 16]} />
      <meshStandardMaterial toneMapped={false} />
      {pointsData.map((data, i) => <Instance key={i} position={data.position} />)}
    </Instances>
  );
};

const DecisionPlane = React.forwardRef((props, ref) => {
  const textProps = {
    font: '/fonts/Inter-Bold.ttf',
    fontSize: 0.7,
    letterSpacing: 0.05,
    anchorX: 'center',
    anchorY: 'middle',
    // outlineWidth: '2.5%', 
    // fillOpacity: 0.8,
    // outlineOpacity: 1.0,
  };

  return (
    <group ref={ref}>
      <Plane args={[12, 12]}><meshBasicMaterial color="#001133" opacity={0.2} transparent side={THREE.DoubleSide} depthWrite={false} /></Plane>
      <lineSegments><edgesGeometry args={[new THREE.PlaneGeometry(12, 12, 10, 10)]} /><lineBasicMaterial color="#446688" opacity={0.3} transparent /></lineSegments>
      <lineSegments><edgesGeometry args={[new THREE.PlaneGeometry(12, 12, 1, 1)]} /><lineBasicMaterial color={COLORS.cyan} opacity={0.5} transparent linewidth={2} /></lineSegments>

      <Text
        {...textProps}
        position={[0, 5.5, 1]}
        color={COLORS.orange}
        outlineColor={COLORS.orange}
      >
        CLASS B (+)
      </Text>

      <Text
        {...textProps}
        position={[0, 5.5, -1]}
        rotation={[0, Math.PI, 0]}
        color={COLORS.cyan}
        outlineColor={COLORS.cyan}
      >
        CLASS A (-)
      </Text>
    </group>
  );
});


const AcademicSection = ({ number, title, children }) => (
  <div className="py-16 border-t border-white/10 flex flex-col gap-6">
    {/* 头部：编号 + 标题 */}
    <div className="flex flex-col gap-2">
      {/* 统一使用 Ice Steel (#B4C5E4) 作为索引颜色 */}
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

const PerceptronScene = () => {
  const planeRef = useRef();
  const statsRef = useRef();
  const data = useMemo(() => generateData(), []);

  const handleRotX = (e) => { if (planeRef.current) planeRef.current.rotation.x = parseFloat(e.target.value); };
  const handleRotY = (e) => { if (planeRef.current) planeRef.current.rotation.y = parseFloat(e.target.value); };
  const handleBias = (e) => { if (planeRef.current) planeRef.current.position.z = parseFloat(e.target.value); };

  return (
    <div className="w-full flex flex-col mt-20">
      <div className="w-full max-w-[95vw] mx-auto mb-12 px-6">
        <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter text-white mb-6">
          The Perceptron
        </h2>
        <div className="flex flex-col md:flex-row gap-8 border-l-2 border-[#CCFF00] pl-6">
          <p className="font-mono text-base md:text-lg text-gray-300 max-w-xl leading-relaxed">
            The dawn of connectionism.
            <br /><br />
            The Perceptron (Rosenblatt, 1958) is the fundamental building block of neural networks. It models a single neuron as a linear binary classifier.
          </p>
        </div>
      </div>

      <div className="w-full relative h-[75vh] bg-black border-y border-white/10">
        <Canvas camera={{ position: [12, 8, 12], fov: 40 }} gl={{ alpha: false, antialias: true }}>
          <color attach="background" args={['#000000']} />
          <OrbitControls makeDefault enableZoom={false} />
          <ambientLight intensity={0.8} />
          <pointLight position={[10, 10, 10]} intensity={1.5} />
          <DecisionPlane ref={planeRef} />
          <PerceptronContent pointsData={data} planeRef={planeRef} statsRef={statsRef} />
          <Preload all />
        </Canvas>

        <div className="absolute top-6 left-6 z-20 pointer-events-none">
          <div ref={statsRef} className="bg-black/50 backdrop-blur border border-white/10 p-4 w-48">Calculating...</div>
        </div>
        <div className={`absolute bottom-6 left-6 w-72 ${THEME.panel}`}>
          <div className={THEME.header}>Parameters</div>
          <div className="space-y-5">
            <div><div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>Weight (Rotation X)</span></div><input type="range" min={-Math.PI / 1.5} max={Math.PI / 1.5} step={0.01} defaultValue={0} onInput={handleRotX} className="custom-range" /></div>
            <div><div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>Weight (Rotation Y)</span></div><input type="range" min={-Math.PI / 1.5} max={Math.PI / 1.5} step={0.01} defaultValue={0} onInput={handleRotY} className="custom-range" /></div>
            <div><div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>Bias (Intercept)</span></div><input type="range" min={-5} max={5} step={0.01} defaultValue={0} onInput={handleBias} className="custom-range" /></div>
          </div>
        </div>
      </div>

      <div className="w-full bg-[#050505] border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-12">
          <AcademicSection number="01" title="The Decision Boundary">
            <p>
              Mathematically, a single neuron is a linear classifier. It cuts the high-dimensional space into two halves using a <strong>Hyperplane</strong>.
            </p>
            <p className="mt-4">
              The equation <span className="text-white bg-white/10 px-1">f(x) = w · x + b</span> governs this plane.
              <br />
              1. <strong>Weights (w)</strong>: Determine the angle of the cut. They represent the "importance" of each input feature.
              <br />
              2. <strong>Bias (b)</strong>: Determines the position of the cut. It acts as a threshold—how much signal is needed to trigger activation.
            </p>
          </AcademicSection>

          <AcademicSection number="02" title="Learning via Error">
            <p>
              How does the machine "learn"? By measuring how wrong it is.
            </p>
            <p className="mt-4">
              We define a <strong>Loss Function</strong> (like the number of misclassified red points). As you adjust the sliders, you are manually performing <em>Gradient Descent</em>: tweaking the parameters to minimize this Loss.
              In modern networks, we use differentiable functions (like Sigmoid or ReLU) so we can use calculus to find the perfect adjustment automatically.
            </p>
          </AcademicSection>

          <AcademicSection number="03" title="The XOR Limit & The AI Winter">
            <p>
              The Perceptron has a fatal flaw: it can only solve problems that are <strong>Linearly Separable</strong>.
            </p>
            <p className="mt-4">
              In 1969, Minsky and Papert proved that a single layer cannot solve the XOR (Exclusive OR) problem, because you cannot draw a straight line to separate the true/false cases of XOR. This mathematical proof froze funding for neural networks for decades—a period known as the <strong>AI Winter</strong>.
              The solution? Stack them. Multiple layers can warp the space itself, solving non-linear problems.
            </p>
          </AcademicSection>
        </div>
      </div>
    </div>
  );
};

export default PerceptronScene;