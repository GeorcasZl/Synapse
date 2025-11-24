import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import useStore from '../store';

// 1. 缓动函数
const easeInOutCubic = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

// 2. 文本坐标生成 (带缓存)
let cachedTextData = null;
const getTextCoordinates = (text, font = "900 130px Inter, sans-serif", particleCount = 5000) => {
  if (cachedTextData) return cachedTextData;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = 2000;
  canvas.height = 800;
  ctx.fillStyle = 'white';
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const validPixels = [];

  for (let y = 0; y < canvas.height; y += 4) {
    for (let x = 0; x < canvas.width; x += 4) {
      if (data[(y * canvas.width + x) * 4 + 3] > 128) validPixels.push({ x, y });
    }
  }

  const targetX = new Float32Array(particleCount);
  const targetY = new Float32Array(particleCount);
  const targetOffsets = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    if (validPixels.length > 0) {
      const pixel = validPixels[Math.floor(Math.random() * validPixels.length)];
      targetX[i] = (pixel.x / canvas.width - 0.5) * 120 + (Math.random() - 0.5) * 0.2;
      targetY[i] = -(pixel.y / canvas.height - 0.5) * 50 + 8 + (Math.random() - 0.5) * 0.2;
      targetOffsets[i] = Math.random() * 100;
    } else {
      targetX[i] = (Math.random() - 0.5) * 150;
      targetY[i] = (Math.random() - 0.5) * 150;
      targetOffsets[i] = 0;
    }
  }

  cachedTextData = { targetX, targetY, targetOffsets };
  return cachedTextData;
};

// --- 组件主体 ---

const SingularityScene = ({ ready, onComplete }) => {
  const mountRef = useRef(null);
  const { singularityActive } = useStore();

  const activeRef = useRef(singularityActive);
  const readyRef = useRef(ready);

  // 记录上一帧状态，用于检测切换瞬间
  const wasActiveRef = useRef(singularityActive);

  const isHoldingRef = useRef(false);
  const progressRef = useRef(0);
  const noiseIntensityRef = useRef(0);

  useEffect(() => { activeRef.current = singularityActive; }, [singularityActive]);
  useEffect(() => { readyRef.current = ready; }, [ready]);

  useEffect(() => {
    if (!mountRef.current) return;

    const PARTICLE_COUNT = 5000;
    // 获取文字坐标数据
    const { targetX, targetY, targetOffsets } = getTextCoordinates("SINGULARITY", "900 150px Inter, sans-serif", PARTICLE_COUNT);

    const width = window.innerWidth;
    const height = window.innerHeight;
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 35;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
      stencil: false,
      depth: false
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    const wrapper = new THREE.Group();
    scene.add(wrapper);

    const particlesGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const chaosPos = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const currentPos = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const a = Math.random() * Math.PI * 2;
      const r = 5 + Math.random() * 40;

      chaosPos[i3] = Math.cos(a) * r;
      chaosPos[i3 + 1] = (Math.random() - 0.5) * 50;
      chaosPos[i3 + 2] = Math.sin(a) * r;

      positions[i3] = chaosPos[i3];
      positions[i3 + 1] = chaosPos[i3 + 1];
      positions[i3 + 2] = chaosPos[i3 + 2];

      currentPos[i3] = chaosPos[i3];
      currentPos[i3 + 1] = chaosPos[i3 + 1];
      currentPos[i3 + 2] = chaosPos[i3 + 2];
    }
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particleMaterial = new THREE.PointsMaterial({
      color: 0xFFFFFF,
      size: 0.07,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });
    const particleSystem = new THREE.Points(particlesGeo, particleMaterial);
    particleSystem.frustumCulled = false;
    wrapper.add(particleSystem);

    const clock = new THREE.Clock();
    const mouse = { x: 0, y: 0 }, prevMouse = { x: 0, y: 0 }, mouseVel = { x: 0, y: 0 };
    let tX = 0, tY = 0;

    const handleMouseMove = (e) => { tX = (e.clientX / width) * 2 - 1; tY = -(e.clientY / height) * 2 + 1; };
    const handleMouseDown = () => { if (readyRef.current && !activeRef.current) isHoldingRef.current = true; };
    const handleMouseUp = () => { isHoldingRef.current = false; };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchstart', handleMouseDown);
    window.addEventListener('touchend', handleMouseUp);

    let afId;
    const interactionRadiusSq = 35;
    const dragDistSq = 60;

    const animate = () => {
      afId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const active = activeRef.current;
      const isReady = readyRef.current;

      // 滚动视差
      const vHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.position.z;
      const scrollYOff = window.scrollY * (vHeight / window.innerHeight) * 1.0;
      wrapper.position.y = scrollYOff;

      // 鼠标数据更新
      mouse.x += (tX - mouse.x) * 0.1;
      mouse.y += (tY - mouse.y) * 0.1;
      mouseVel.x = mouse.x - prevMouse.x;
      mouseVel.y = mouse.y - prevMouse.y;
      const mouseSpeed = Math.sqrt(mouseVel.x * mouseVel.x + mouseVel.y * mouseVel.y);
      prevMouse.x = mouse.x; prevMouse.y = mouse.y;

      // [优化] 内联 Opacity 缓动
      if (isReady && particleMaterial.opacity < 0.8) {
        particleMaterial.opacity += (0.8 - particleMaterial.opacity) * 0.05;
      }

      if (!active && isReady) {
        if (isHoldingRef.current) {
          progressRef.current = Math.min(progressRef.current + 0.008, 1);
          if (progressRef.current === 1) onComplete();
        } else {
          progressRef.current = Math.max(progressRef.current - 0.02, 0);
        }
      }

      const p = easeInOutCubic(progressRef.current);

      const targetNoise = active ? 0.08 : 0;
      // [优化] 内联 Noise 缓动
      noiseIntensityRef.current += (targetNoise - noiseIntensityRef.current) * 0.03;
      const currentNoise = noiseIntensityRef.current;

      const wMx = mouse.x * 45;
      const wMy = (mouse.y * 35) + scrollYOff;

      if (active && !wasActiveRef.current) {
        velocities.fill(0);
      }
      wasActiveRef.current = active;

      if (!active) {
        // === 模式 A：混沌流体 ===
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const ix = i * 3, iy = ix + 1, iz = ix + 2;
          const floatX = Math.sin(chaosPos[iy] * 0.08 + t * 0.1) * 0.008;
          const floatY = Math.cos(chaosPos[ix] * 0.08 + t * 0.1) * 0.008;

          const dx = wMx - chaosPos[ix];
          const dy = wMy - chaosPos[iy];
          const distSq = dx * dx + dy * dy;

          if (distSq < dragDistSq && mouseSpeed > 0.001) {
            const dist = Math.sqrt(distSq);
            const forceFactor = (1 - dist / 7.74);
            velocities[ix] += mouseVel.x * forceFactor * 3.0;
            velocities[iy] += mouseVel.y * forceFactor * 3.0;
          }
          velocities[ix] = (velocities[ix] + floatX) * 0.96;
          velocities[iy] = (velocities[iy] + floatY) * 0.96;
          velocities[iz] *= 0.96;
          chaosPos[ix] += velocities[ix];
          chaosPos[iy] += velocities[iy];
          chaosPos[iz] += velocities[iz];

          if (chaosPos[ix] > 60) chaosPos[ix] -= 120; else if (chaosPos[ix] < -60) chaosPos[ix] += 120;
          if (chaosPos[iy] > 50) chaosPos[iy] -= 100; else if (chaosPos[iy] < -50) chaosPos[iy] += 100;

          // [优化] 内联 lerp：从混沌向目标过渡
          currentPos[ix] = chaosPos[ix] + (targetX[i] - chaosPos[ix]) * p;
          currentPos[iy] = chaosPos[iy] + (targetY[i] - chaosPos[iy]) * p;
          currentPos[iz] = chaosPos[iz] + (0 - chaosPos[iz]) * p;
        }
      } else {
        // === 模式 B：成型扰动 ===
        const t08 = t * 0.8;
        const t05 = t * 0.5;
        const hasNoise = currentNoise > 0.0001;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const ix = i * 3, iy = ix + 1, iz = ix + 2;

          const tx = targetX[i];
          const ty = targetY[i];

          let targetPosX = tx;
          let targetPosY = ty;
          let targetPosZ = 0;

          if (hasNoise) {
            const to = targetOffsets[i];
            targetPosX += Math.sin(ty * 0.1 + t08 + to) * currentNoise;
            targetPosY += Math.cos(tx * 0.1 + t08 + to) * currentNoise;
            targetPosZ += Math.sin(tx * 0.2 + t05) * currentNoise * 2;
          }

          const dx = wMx - currentPos[ix];
          const dy = wMy - currentPos[iy];
          const distSq = dx * dx + dy * dy;

          if (distSq < interactionRadiusSq && mouseSpeed > 0.001) {
            const dist = Math.sqrt(distSq);
            const forceFactor = (1 - dist / 5.91);
            const rndX = (Math.random() - 0.5) * 0.15;
            const rndY = (Math.random() - 0.5) * 0.15;

            velocities[ix] += (mouseVel.x * 4.0 + rndX) * forceFactor;
            velocities[iy] += (mouseVel.y * 4.0 + rndY) * forceFactor;
            velocities[iz] += ((Math.random() - 0.5) * 0.15) * forceFactor;
          }

          velocities[ix] *= 0.90;
          velocities[iy] *= 0.90;
          velocities[iz] *= 0.90;

          currentPos[ix] += velocities[ix];
          currentPos[iy] += velocities[iy];
          currentPos[iz] += velocities[iz];

          // [优化] 内联 lerp：回归目标位置
          currentPos[ix] += (targetPosX - currentPos[ix]) * 0.05;
          currentPos[iy] += (targetPosY - currentPos[iy]) * 0.05;
          currentPos[iz] += (targetPosZ - currentPos[iz]) * 0.05;
        }
      }

      positions.set(currentPos);
      particleSystem.geometry.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(afId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchstart', handleMouseDown);
      window.removeEventListener('touchend', handleMouseUp);

      if (mountRef.current) mountRef.current.innerHTML = '';
      particlesGeo.dispose();
      particleMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="fixed inset-0 z-0 pointer-events-none" />;
};

export default SingularityScene;