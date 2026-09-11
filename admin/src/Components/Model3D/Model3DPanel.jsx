import React, { useEffect, useRef, useState } from "react";
import { authorizedFetch } from "../../services/api";
import "./Model3DPanel.css";

const POLL_INTERVAL = 3000;

const STATUS_COPY = {
  processing: "Generating 3D model from photos…",
  rendering: "Rendering 360° turntable frames…",
};

const SLOT_ORDER = ["front", "left", "back", "right"];
const SLOT_LETTER = { front: "F", left: "L", back: "B", right: "R" };

// Auto-cycles the rendered turntable frames as a lightweight "spin" preview.
// (We don't load the raw GLB here — Tripo3D's CDN doesn't send
// Access-Control-Allow-Origin, so a browser can't fetch it directly; only
// our backend's headless renderer can, via request interception.)
const Model3DFramePreview = ({ frames }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (frames.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % frames.length), 120);
    return () => clearInterval(id);
  }, [frames.length]);

  if (!frames.length) return null;
  return <img src={frames[index]} alt="3D model preview" className="model3d-frame-preview" />;
};

// Lets the admin hand-pick which 4 photos are front/left/back/right of the
// SAME shoe. Matters because a product's image + subImages often mix
// single-shoe and paired-shoe shots — feeding mismatched subjects into
// multiview reconstruction produces warped geometry at the angles where
// those constraints collide.
const SourceImagePicker = ({ images, selection, onToggle }) => {
  const slotForImage = (url) => SLOT_ORDER.find((s) => selection[s] === url) || null;

  return (
    <div className="model3d-picker">
      <p className="model3d-picker-label">
        SOURCE PHOTOS — click to assign Front → Left → Back → Right (same shoe, not a pair)
      </p>
      <div className="model3d-picker-grid">
        {images.map((url) => {
          const slot = slotForImage(url);
          return (
            <button
              key={url}
              type="button"
              className={`model3d-picker-thumb ${slot ? "assigned" : ""}`}
              onClick={() => onToggle(url)}
              title={slot ? `Assigned: ${slot}` : "Click to assign"}
            >
              <img src={url} alt="" />
              {slot && <span className="model3d-picker-badge">{SLOT_LETTER[slot]}</span>}
            </button>
          );
        })}
      </div>
      <div className="model3d-picker-legend">
        {SLOT_ORDER.map((s) => (
          <span key={s} className={`model3d-picker-legend-item ${selection[s] ? "filled" : ""}`}>
            {SLOT_LETTER[s]} = {s}
          </span>
        ))}
      </div>
    </div>
  );
};

/**
 * Triggers + tracks Tripo3D generation for a single product (base product or
 * colorway — both are plain Product docs). Reused in ColorwayTab (right after
 * a new colorway is created) and in the Edit Product modal.
 */
const Model3DPanel = ({ productId, images = [], disabled }) => {
  const [model3d, setModel3d] = useState(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef(null);

  const uniqueImages = [...new Set(images.filter(Boolean))];

  const [selection, setSelection] = useState({ front: "", left: "", back: "", right: "" });

  // Default to the old positional heuristic (image, subImages[0..2]) so
  // well-organized products need zero manual work — override is only needed
  // for messy sets like this one.
  useEffect(() => {
    const [a, b, c, d] = uniqueImages;
    setSelection({ front: a || "", left: b || "", back: c || "", right: d || "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.join("|")]);

  const toggleImage = (url) => {
    const existingSlot = SLOT_ORDER.find((s) => selection[s] === url);
    if (existingSlot) {
      setSelection((s) => ({ ...s, [existingSlot]: "" }));
      return;
    }
    const emptySlot = SLOT_ORDER.find((s) => !selection[s]);
    if (!emptySlot) return; // all 4 filled — unassign one first
    setSelection((s) => ({ ...s, [emptySlot]: url }));
  };

  const fetchStatus = async () => {
    try {
      const res = await authorizedFetch(`/model-status/${productId}`);
      const data = await res.json();
      if (data.success) setModel3d(data.model3d);
    } catch {
      // transient poll error — try again next tick
    }
  };

  useEffect(() => {
    if (!productId) return;
    fetchStatus();
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  useEffect(() => {
    const active = model3d?.status === "processing" || model3d?.status === "rendering";
    if (active && !pollRef.current) {
      pollRef.current = setInterval(fetchStatus, POLL_INTERVAL);
    } else if (!active && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model3d?.status]);

  const handleGenerate = async () => {
    setStarting(true);
    setError("");
    try {
      const res = await authorizedFetch("/generate-3d-model", {
        method: "POST",
        body: JSON.stringify({ productId, images: selection }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to start generation.");
        return;
      }
      setModel3d({ status: "processing" });
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  };

  const status = model3d?.status || "none";
  const isActive = status === "processing" || status === "rendering";

  return (
    <div className="model3d-panel glass-medium">
      <div className="model3d-header">
        <span className="form-label">3D MODEL</span>
        {status === "ready" && <span className="model3d-badge ready">READY</span>}
        {status === "failed" && <span className="model3d-badge failed">FAILED</span>}
      </div>

      {isActive ? (
        <div className="model3d-loading">
          <div className="model3d-spinner" />
          <p>{STATUS_COPY[status] || "Working…"}</p>
        </div>
      ) : status === "ready" ? (
        <div className="model3d-ready">
          <Model3DFramePreview frames={model3d.turntableFrames || []} />
          <p className="model3d-meta">{model3d.turntableFrames?.length || 0} turntable frames generated</p>
          {uniqueImages.length > 0 && (
            <SourceImagePicker images={uniqueImages} selection={selection} onToggle={toggleImage} />
          )}
          <button className="footer-btn-secondary" onClick={handleGenerate} disabled={starting || !selection.front}>
            {starting ? "STARTING…" : "REGENERATE"}
          </button>
        </div>
      ) : (
        <>
          <p className="model3d-hint">
            Turns 4 photos of this shoe into a spinnable 3D model, powering the 360° viewer and AR try-on on mobile.
          </p>
          {model3d?.error && <p className="model3d-error">{model3d.error}</p>}
          {uniqueImages.length > 0 && (
            <SourceImagePicker images={uniqueImages} selection={selection} onToggle={toggleImage} />
          )}
          <button
            className="footer-btn-primary"
            onClick={handleGenerate}
            disabled={disabled || starting || !selection.front}
          >
            {starting ? "STARTING…" : "GENERATE 3D MODEL"}
          </button>
          {error && <p className="model3d-error">{error}</p>}
        </>
      )}
    </div>
  );
};

export default Model3DPanel;
