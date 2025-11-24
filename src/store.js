import { create } from 'zustand';

const useStore = create((set) => ({
  // 光标状态
  cursorType: 'default', 
  setCursorType: (type) => set({ cursorType: type }),
  
  // 磁力吸附目标
  magneticTarget: { x: 0, y: 0, width: 0, height: 0, active: false },
  setMagneticTarget: (target) => set({ magneticTarget: target }),

  // 章节状态
  activeChapter: 0,
  setActiveChapter: (index) => set({ activeChapter: index }),

  // Chapter 0 特有状态
  singularityActive: false,
  setSingularityActive: (active) => set({ singularityActive: active }),
  
  // 滚动锁定
  scrollLocked: true,
  setScrollLocked: (locked) => set({ scrollLocked: locked }),

  perceptionLoss: 1.0, // 初始 Loss
  setPerceptionLoss: (v) => set({ perceptionLoss: v }),
  
  isConverged: false, // 是否完成训练
  setIsConverged: (v) => set({ isConverged: v }),
}));

export default useStore;