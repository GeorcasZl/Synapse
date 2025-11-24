import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import useStore from '../store';

export const ScrambleText = ({ text, trigger, className = "" }) => {
  const [display, setDisplay] = useState(text);
  const chars = '!<>-_\\/[]{}—=+*^?#';
  
  useEffect(() => {
    if (!trigger || text.length > 20) { 
        setDisplay(text); 
        return; 
    }
    
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplay(text.split("").map((l, i) => {
        if (i < iteration) return text[i];
        return chars[Math.floor(Math.random() * chars.length)];
      }).join(""));
      
      if (iteration >= text.length) clearInterval(interval);
      iteration += 1 / 2; 
    }, 30);
    
    return () => clearInterval(interval);
  }, [trigger, text]);

  return <span className={className}>{display}</span>;
};

const Button = ({ children, className = "", onClick }) => {
  const ref = useRef(null);
  const { setCursorType, setMagneticTarget } = useStore();
  const [isHovered, setIsHovered] = useState(false);

  const handleEnter = () => {
    setIsHovered(true);
    setCursorType('magnetic');
    if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        setMagneticTarget({ x: rect.left, y: rect.top, width: rect.width, height: rect.height, active: true });
    }
  };

  const handleLeave = () => {
    setIsHovered(false);
    setCursorType('default');
    setMagneticTarget({ active: false, x:0, y:0, width:0, height:0 });
  };

  return (
    <button
      ref={ref}
      onClick={onClick}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      // 核心修复：
      // 1. px-8: 增加内边距，给绝对定位的括号预留空间
      // 2. relative: 确保括号相对于按钮定位
      className={`relative flex items-center justify-center px-8 py-3 font-mono text-xs uppercase tracking-widest border border-transparent hover:border-[#CCFF00]/30 transition-colors duration-300 whitespace-nowrap ${className}`}
    >
      {/* 左括号: 绝对定位到左侧 8px 处 */}
      <motion.span 
        animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : 5 }} 
        className="absolute left-2 text-[#CCFF00] font-bold"
      >
        [
      </motion.span>
      
      <span className={`transition-colors duration-300 ${isHovered ? 'text-[#CCFF00]' : 'text-[#E0E0E0]'}`}>
        {typeof children === 'string' ? <ScrambleText text={children} trigger={isHovered} /> : children}
      </span>
      
      {/* 右括号: 绝对定位到右侧 8px 处 */}
      <motion.span 
        animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : -5 }} 
        className="absolute right-2 text-[#CCFF00] font-bold"
      >
        ]
      </motion.span>
    </button>
  );
};

export default Button;