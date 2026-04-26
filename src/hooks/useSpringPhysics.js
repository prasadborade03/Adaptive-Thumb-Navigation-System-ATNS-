import { useRef, useCallback, useEffect } from 'react';

export function useSpringPhysics(onUpdate) {
  const currentRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });
  const velocityRef = useRef({ x: 0, y: 0 });
  const runningRef = useRef(false);
  const rafRef = useRef(null);

  const STIFFNESS = 0.12;
  const DAMPING = 0.72;
  const REST = 0.5;

  const tick = useCallback(() => {
    const vx = (velocityRef.current.x + (targetRef.current.x - currentRef.current.x) * STIFFNESS) * DAMPING;
    const vy = (velocityRef.current.y + (targetRef.current.y - currentRef.current.y) * STIFFNESS) * DAMPING;
    velocityRef.current = { x: vx, y: vy };
    currentRef.current = {
      x: currentRef.current.x + vx,
      y: currentRef.current.y + vy,
    };
    onUpdate(currentRef.current);

    const dx = Math.abs(targetRef.current.x - currentRef.current.x);
    const dy = Math.abs(targetRef.current.y - currentRef.current.y);
    if (dx < REST && dy < REST && Math.abs(vx) + Math.abs(vy) < REST) {
      runningRef.current = false;
      currentRef.current = { ...targetRef.current };
      onUpdate(currentRef.current);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onUpdate]);

  const setTarget = useCallback((pos) => {
    targetRef.current = pos;
    if (!runningRef.current) {
      runningRef.current = true;
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  const setCurrent = useCallback((pos) => {
    currentRef.current = { ...pos };
    targetRef.current = { ...pos };
    velocityRef.current = { x: 0, y: 0 };
  }, []);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  return { setTarget, setCurrent, stop, current: currentRef };
}
