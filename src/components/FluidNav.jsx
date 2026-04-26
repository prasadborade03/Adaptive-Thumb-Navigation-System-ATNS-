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

const DOCK_CENTER = {
  bottom: { x: W / 2, y: H - 60 },
  left:   { x: 44,    y: H - 260 },
  right:  { x: W - 44, y: H - 260 },
};

export default function FluidNav({ activeTab, setActiveTab }) {
  const [dock, setDock] = useState('bottom');
  const [phase, setPhase] = useState('idle');
  const [dragPos, setDragPos] = useState(null);

  const wrapperRef = useRef(null);
  const navRef = useRef(null);
  const longPressTimer = useRef(null);
  const startPointer = useRef({ x: 0, y: 0 });
  const grabOffset = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);
  const currentPos = useRef({ x: 0, y: 0 });

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
      const dp = DOCK_CENTER[target];
      setDragPos({ x: dp.x, y: dp.y, snapping: true });

      setTimeout(() => {
        setDock(target);
        setDragPos(null);
        setPhase('idle');
      }, 450);
    } else {
      setPhase('idle');
    }
  }, [phase, spring]);

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
        const dp = DOCK_CENTER[target];
        setDragPos({ x: dp.x, y: dp.y, snapping: true });
        setTimeout(() => {
          setDock(target);
          setDragPos(null);
          setPhase('idle');
        }, 550);
      });
    });
  }, [dock, phase, getRect]);

  /* ---- Render logic ---- */
  const isVertical = dock !== 'bottom';
  const showSwap = dock !== 'bottom' && phase === 'idle' && !dragPos;

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
      transform: `translate(-50%, -50%) ${phase === 'dragging' ? 'scale(1.03)' : ''}`,
      transition: dragPos.snapping
        ? 'left 400ms cubic-bezier(0.34, 1.56, 0.64, 1), top 400ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 200ms ease'
        : 'none',
      zIndex: 200,
    };
  }

  const dockClass = !dragPos ? `fluid-nav--${dock}` : '';
  const stateClass = phase === 'activated' ? 'fluid-nav--activated' : '';

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
        className={`fluid-nav ${dockClass} ${stateClass}`}
        style={dragPos ? navStyle : undefined}
      >
        {/* Glass pill */}
        <div className={`glass-pill ${renderVertical ? 'glass-pill--vertical' : 'glass-pill--horizontal'}`}>
          <div className={`glass-pill__icons ${renderVertical ? 'glass-pill__icons--vertical' : 'glass-pill__icons--horizontal'}`}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`nav-icon-button ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => { if (!didDrag.current) setActiveTab(tab.id); }}
              >
                <tab.Icon />
              </button>
            ))}
          </div>
        </div>

        {/* Swap arrow */}
        {showSwap && (
          <div
            className="swap-button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleSwap}
          >
            <span>{dock === 'left' ? '▶' : '◀'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
