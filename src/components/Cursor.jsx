import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useStore from '../store';

const lerp = (start, end, factor) => start + (end - start) * factor;

const Cursor = () => {
  const cursorRef = useRef(null);
  const { cursorType, magneticTarget } = useStore();
  
  const [isVisible, setIsVisible] = useState(false);
  const isClickedRef = useRef(false);

  // 物理状态：x, y, scale(缩放), opacity(透明度)
  const state = useRef({
      x: -100,
      y: -100,
      scale: 1, 
      opacity: 0
  });
  
  const target = useRef({ x: -100, y: -100 });

  useEffect(() => {
    const handleMouseMove = (e) => { 
        target.current.x = e.clientX;
        target.current.y = e.clientY;
        if (!isVisible) setIsVisible(true);
    };
    
    // 监听点击
    const handleMouseDown = () => { isClickedRef.current = true; };
    const handleMouseUp = () => { isClickedRef.current = false; };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    let animationFrameId;

    const animate = () => {
      if (!cursorRef.current) return;

      let tx = target.current.x;
      let ty = target.current.y;
      
      // --- 1. 计算目标缩放 (替代 CSS width/height 动画) ---
      // 我们设定基准尺寸为 w-3 (12px)
      // scale = 1.0 -> 12px (默认)
      // scale = 4.0 -> 48px (磁吸)
      let tScale = 1.0; 
      let tOpacity = isVisible ? 1 : 0;

      if (cursorType === 'magnetic' && magneticTarget.active) {
        tx = lerp(magneticTarget.x + magneticTarget.width / 2, target.current.x, 0.3); 
        ty = lerp(magneticTarget.y + magneticTarget.height / 2, target.current.y, 0.3);
        
        tScale = 4.0; // 放大 4 倍
        tOpacity = isVisible ? 0.3 : 0; // 磁吸时透明度降低
      }

      // 点击反馈：缩小
      if (isClickedRef.current) {
          tScale *= 0.6;
      }

      // --- 2. 物理插值 (JS 驱动，绝对平滑) ---
      state.current.x = lerp(state.current.x, tx, 0.15); // 位置跟手
      state.current.y = lerp(state.current.y, ty, 0.15);
      state.current.scale = lerp(state.current.scale, tScale, 0.15); // 缩放平滑
      state.current.opacity = lerp(state.current.opacity, tOpacity, 0.1);

      // --- 3. 应用样式 ---
      // 关键点：单层结构，transform 同时控制位置和缩放
      cursorRef.current.style.transform = `
        translate3d(${state.current.x}px, ${state.current.y}px, 0) 
        translate(-50%, -50%) 
        scale(${state.current.scale})
      `;
      cursorRef.current.style.opacity = state.current.opacity;
      
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mouseup', handleMouseUp);
        cancelAnimationFrame(animationFrameId);
    };
  }, [cursorType, magneticTarget, isVisible]); 

  const baseClasses = "fixed top-0 left-0 w-3 h-3 rounded-full pointer-events-none z-[99999] mix-blend-difference will-change-transform";
  const typeClasses = cursorType === 'magnetic' 
      ? 'bg-[#CCFF00] blur-xs' // 磁吸态 (JS控制了opacity)
      : 'bg-[#E0E0E0]';             // 默认态

  return createPortal(
    <div 
        ref={cursorRef} 
        className={`${baseClasses} ${typeClasses} transition-colors duration-200`}
        style={{ opacity: 0 }} // 初始隐藏
    />,
    document.body
  );
};

export default Cursor;