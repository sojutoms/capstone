import React, { useEffect, useRef, useState } from "react";
import "./Shoe360Viewer.css";

const PX_PER_FRAME = 8;

const Shoe360Viewer = ({ frames }) => {
  const [index, setIndex] = useState(0);
  const [interacted, setInteracted] = useState(false);
  const dragState = useRef(null);
  const frameCount = frames.length;

  useEffect(() => {
    frames.forEach((src) => { const img = new Image(); img.src = src; });
  }, [frames]);

  const handlePointerDown = (e) => {
    dragState.current = { startX: e.clientX, startIndex: index };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!interacted) setInteracted(true);
  };

  const handlePointerMove = (e) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const delta = Math.round(dx / PX_PER_FRAME);
    let next = (dragState.current.startIndex - delta) % frameCount;
    if (next < 0) next += frameCount;
    setIndex(next);
  };

  const handlePointerUp = () => { dragState.current = null; };

  if (!frameCount) return null;

  return (
    <div
      className="shoe360-viewer"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <img src={frames[index]} alt="360° product view" className="shoe360-image" draggable={false} />

      {!interacted && (
        <div className="shoe360-hint">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 8l4 4-4 4M7 8l-4 4 4 4M3 12h18" />
          </svg>
          DRAG TO SPIN
        </div>
      )}
    </div>
  );
};

export default Shoe360Viewer;
