import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSpringPhysics } from '../hooks/useSpringPhysics';

import HomeIcon from '../assets/icons/Home.svg?react';
import SearchIcon from '../assets/icons/Search.svg?react';
import ReelsIcon from '../assets/icons/Reels.svg?react';
import ProfileIcon from '../assets/icons/Profile.svg?react';

const tabs = [
  { id: 0, Icon: HomeIcon, label: 'Home' },
  { id: 1, Icon: SearchIcon, label: 'Search' },
  { id: 2, Icon: ReelsIcon, label: 'Reels' },
  { id: 3, Icon: ProfileIcon, label: 'Profile' },
];

const W = 390;
const H = 844;
const LONG_PRESS_MS = 300;
const DRAG_THRESHOLD = 5;
const MAG_LEFT = 110;
const MAG_RIGHT = W - 110;

export default function FluidNav({ activeTab, setActiveTab }) {
  const [dock, setDock] = useState('bottom');
  const [phase, setPhase] = useState('idle');
  const [dragPos, setDragPos] = useState(null);
  const [arrowVisible, setArrowVisible] = useState(false);

  const wrapperRef = useRef(null);
  const navRef = useRef(null);
  const longPressTimer = useRef(null);
  const startPointer = useRef({ x: 0, y: 0 });
  const grabOffset = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);
  const currentPos = useRef({ x: 0, y: 0 });
  const arrowTimer = useRef(null);
  const navDimensions = useRef({
    horizontal: { w: 216, h: 56 },
    vertical: { w: 56, h: 232 },
  });
  const [, setDimsVersion] = useState(0);

  const spring = useSpringPhysics(
    useCallback((pos) => {
      currentPos.current = pos;
      setDragPos({ x: pos.x, y: pos.y });
    }, [])
  );

  const getRect = useCallback(() => {
    return wrapperRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
  }, []);

  const toLocal = useCallback((cx, cy) => {
    const r = getRect();
    return { x: cx - r.left, y: cy - r.top };
  }, [getRect]);

  const computeDockCenter = useCallback((dockName) => {
    const mode = dockName === 'bottom' ? 'horizontal' : 'vertical';
    const { w, h } = navDimensions.current[mode];

    if (dockName === 'bottom') {
      return { x: W / 2, y: H - 40 - h / 2 };
    }
    if (dockName === 'left') {
      return { x: 16 + w / 2, y: H - 120 - h / 2 };
    }
    return { x: W - 16 - w / 2, y: H - 120 - h / 2 };
  }, []);

  /* ---- Pointer handlers ---- */
  const onPointerDown = useCallback((e) => {
    if (phase === 'snapping') return;
    if (!navRef.current?.contains(e.target)) return;

    const pos = toLocal(e.clientX, e.clientY);
    startPointer.current = pos;
    didDrag.current = false;

    const navRect = navRef.current.getBoundingClientRect();
    const cRect = getRect();
    const ncx = (navRect.left + navRect.width / 2) - cRect.left;
    const ncy = (navRect.top + navRect.height / 2) - cRect.top;
    grabOffset.current = { x: pos.x - ncx, y: pos.y - ncy };
    
    // Store pointer id for later capture
    startPointer.current.pointerId = e.pointerId;

    longPressTimer.current = setTimeout(() => {
      setPhase('activated');
      // Capture pointer only when long-press activates
      try { wrapperRef.current?.setPointerCapture(startPointer.current.pointerId); } catch(err) {}
    }, LONG_PRESS_MS);
  }, [phase, toLocal, getRect]);

  const onPointerMove = useCallback((e) => {
    const pos = toLocal(e.clientX, e.clientY);

    if (phase !== 'activated' && phase !== 'dragging') {
      if (longPressTimer.current) {
        const dx = Math.abs(pos.x - startPointer.current.x);
        const dy = Math.abs(pos.y - startPointer.current.y);
        if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }
      return;
    }

    if (phase === 'activated') {
      setPhase('dragging');
      const navRect = navRef.current.getBoundingClientRect();
      const cRect = getRect();
      const cx = (navRect.left + navRect.width / 2) - cRect.left;
      const cy = (navRect.top + navRect.height / 2) - cRect.top;
      spring.setCurrent({ x: cx, y: cy });
    }

    didDrag.current = true;
    spring.setTarget({ x: pos.x - grabOffset.current.x, y: pos.y - grabOffset.current.y });
  }, [phase, toLocal, spring, getRect]);

  const onPointerUp = useCallback((e) => {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    try { wrapperRef.current?.releasePointerCapture(e.pointerId); } catch(err) {}

    if (phase === 'dragging') {
      spring.stop();
      const pos = currentPos.current;
      let target = 'bottom';
      if (pos.x < MAG_LEFT) target = 'left';
      else if (pos.x > MAG_RIGHT) target = 'right';

      setPhase('snapping');
      const dp = computeDockCenter(target);
      setDragPos({ x: dp.x, y: dp.y, snapping: true });

      setTimeout(() => {
        setDock(target);
        setDragPos(null);
        setPhase('idle');
      }, 500);
    } else {
      setPhase('idle');
    }
  }, [phase, spring, computeDockCenter]);

  /* ---- Swap handler ---- */
  const handleSwap = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    if (phase !== 'idle') return;

    const target = dock === 'left' ? 'right' : 'left';
    const navRect = navRef.current.getBoundingClientRect();
    const cRect = getRect();
    const cx = (navRect.left + navRect.width / 2) - cRect.left;
    const cy = (navRect.top + navRect.height / 2) - cRect.top;

    // Start from current position
    setDragPos({ x: cx, y: cy, snapping: false });
    setPhase('snapping');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const dp = computeDockCenter(target);
        setDragPos({ x: dp.x, y: dp.y, snapping: true });
        setTimeout(() => {
          setDock(target);
          setDragPos(null);
          setPhase('idle');
        }, 550);
      });
    });
  }, [dock, phase, getRect, computeDockCenter]);

  /* ---- Render logic ---- */
  const isVertical = dock !== 'bottom';
  const isDragging = phase === 'dragging';
  const forceHideSwap = isDragging || phase === 'activated' || phase === 'snapping';
  const showSwap = !forceHideSwap && dock !== 'bottom' && phase === 'idle' && !dragPos && arrowVisible;

  // While dragging, determine shape based on position
  const dragVertical = dragPos && (dragPos.x < MAG_LEFT || dragPos.x > MAG_RIGHT);
  const renderVertical = dragPos ? dragVertical : isVertical;

  // Build inline style when dragging/snapping
  let navStyle = {};
  if (dragPos) {
    navStyle = {
      position: 'absolute',
      left: `${dragPos.x}px`,
      top: `${dragPos.y}px`,
      transform: `translate(-50%, -50%) ${phase === 'dragging' ? 'scale(1.05)' : ''}`,
      transition: dragPos.snapping
        ? 'left 460ms cubic-bezier(0.22, 1.2, 0.32, 1), top 460ms cubic-bezier(0.22, 1.2, 0.32, 1), transform 240ms ease-out'
        : 'none',
      zIndex: 200,
      willChange: phase === 'dragging' ? 'transform' : 'auto',
    };
  }

  const stateClass = phase === 'activated' ? 'fluid-nav--activated' : '';
  const dragClass = phase === 'dragging' ? 'fluid-nav--dragging' : '';
  const phaseClass = `fluid-nav--phase-${phase}`;
  const ActiveIcon = tabs[activeTab].Icon;

  useEffect(() => {
    if (arrowTimer.current) {
      clearTimeout(arrowTimer.current);
      arrowTimer.current = null;
    }

    if (dock !== 'bottom' && phase === 'idle' && !dragPos) {
      arrowTimer.current = setTimeout(() => {
        setArrowVisible(true);
      }, 120);
    } else {
      setArrowVisible(false);
      if (arrowTimer.current) {
        clearTimeout(arrowTimer.current);
        arrowTimer.current = null;
      }
    }

    return () => {
      if (arrowTimer.current) {
        clearTimeout(arrowTimer.current);
        arrowTimer.current = null;
      }
    };
  }, [dock, phase, dragPos]);

  useEffect(() => {
    if (!navRef.current) return undefined;

    const observer = new ResizeObserver((entries) => {
      if (!entries.length) return;
      if (phase !== 'idle' || dragPos) return;

      const rect = entries[0].contentRect;
      const mode = dock === 'bottom' ? 'horizontal' : 'vertical';
      const prev = navDimensions.current[mode];
      const nextW = Math.round(rect.width);
      const nextH = Math.round(rect.height);

      if (prev.w !== nextW || prev.h !== nextH) {
        navDimensions.current[mode] = { w: nextW, h: nextH };
        setDimsVersion((v) => v + 1);
      }
    });

    observer.observe(navRef.current);
    return () => observer.disconnect();
  }, [dock, phase, dragPos]);

  const dockCenter = computeDockCenter(dock);
  const restingStyle = {
    position: 'absolute',
    left: `${dockCenter.x}px`,
    top: `${dockCenter.y}px`,
    transform: 'translate(-50%, -50%)',
    zIndex: 200,
    willChange: 'auto',
  };

  return (
    <div
      ref={wrapperRef}
      className="fluid-nav-wrapper"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ touchAction: 'none' }}
    >
      <div
        ref={navRef}
        className={`fluid-nav ${stateClass} ${dragClass} ${phaseClass}`}
        style={dragPos ? navStyle : restingStyle}
      >
        <div className="capsule-layer">
          {/* Glass pill */}
          <div className={`glass-pill ${renderVertical ? 'glass-pill--vertical' : 'glass-pill--horizontal'} ${isDragging ? 'glass-pill--dragging' : ''}`}>
            <div className={`glass-pill__icons ${renderVertical ? 'glass-pill__icons--vertical' : 'glass-pill__icons--horizontal'} ${isDragging ? 'glass-pill__icons--dragging' : ''}`}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`nav-icon-button ${activeTab === tab.id ? 'active' : ''} ${isDragging ? 'nav-icon-button--drag' : ''}`}
                  onClick={() => { if (!didDrag.current) setActiveTab(tab.id); }}
                  style={{ '--icon-order': tab.id }}
                >
                  <tab.Icon />
                </button>
              ))}
              {isDragging && (
                <div className="drag-active-icon">
                  <ActiveIcon />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Swap arrow overlay layer (separate from capsule sizing) */}
        <button
          className={`swap-button ${showSwap ? 'swap-button--visible' : 'swap-button--hidden'} ${dock === 'left' ? 'swap-button--point-right' : 'swap-button--point-left'}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleSwap}
          tabIndex={showSwap ? 0 : -1}
          aria-hidden={!showSwap}
        >
          <span>◀</span>
        </button>
      </div>
    </div>
  );
}
