import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./CommandPalette.css";

// ─── All searchable commands ──────────────────────────────────────────────────
const ALL_COMMANDS = [
  // Navigation
  { id: "nav-dashboard", label: "Go to Dashboard", icon: "📊", group: "Navigate", path: "/admin/dashboard" },
  { id: "nav-products", label: "Go to Products", icon: "📦", group: "Navigate", path: "/admin/products" },
  { id: "nav-addproduct", label: "Add New Product", icon: "➕", group: "Navigate", path: "/admin/addproduct" },
  { id: "nav-addstock", label: "Add Stock", icon: "📥", group: "Navigate", path: "/admin/products#addstock" },
  { id: "nav-transactions", label: "Go to Transactions", icon: "💳", group: "Navigate", path: "/admin/admin/transactions" },
  { id: "nav-sales", label: "Go to Sales Dashboard", icon: "💰", group: "Navigate", path: "/admin/admin-sales" },
  { id: "nav-users", label: "Go to User Management", icon: "👥", group: "Navigate", path: "/admin/users" },
  { id: "nav-sku", label: "Go to SKU Viewer", icon: "🔍", group: "Navigate", path: "/admin/skuviewer" },
  { id: "nav-security", label: "Go to Security Center", icon: "🔐", group: "Navigate", path: "/admin/security" },
  // Actions
  { id: "act-logout", label: "Log Out", icon: "🚪", group: "Actions", action: "logout" },
  { id: "act-refresh", label: "Refresh Page", icon: "🔄", group: "Actions", action: "refresh" },
  { id: "act-fullscreen", label: "Toggle Fullscreen", icon: "⛶", group: "Actions", action: "fullscreen" },
  // Filters (contextual hints)
  { id: "hint-lowstock", label: "Filter: Low Stock Products", icon: "⚠️", group: "Hints", path: "/admin/products" },
  { id: "hint-pending", label: "Filter: Pending Orders", icon: "⏳", group: "Hints", path: "/admin/admin/transactions" },
  // Keyboard shortcuts
  { id: "kb-1", label: "Keyboard shortcut: Alt+D → Dashboard", icon: "⌨️", group: "Shortcuts", path: "/admin/dashboard" },
  { id: "kb-2", label: "Keyboard shortcut: Alt+P → Products", icon: "⌨️", group: "Shortcuts", path: "/admin/products" },
  { id: "kb-3", label: "Keyboard shortcut: Alt+T → Transactions", icon: "⌨️", group: "Shortcuts", path: "/admin/admin/transactions" },
];

// ─── Keyboard shortcuts wired separately ─────────────────────────────────────
const ALT_SHORTCUTS = {
  d: "/admin/dashboard",
  p: "/admin/products",
  t: "/admin/admin/transactions",
  s: "/admin/admin-sales",
  u: "/admin/users",
  k: "/admin/skuviewer",
};

const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();

  // ── Open/close ──────────────────────────────────────────────────────────
  const openPalette = useCallback(() => { setOpen(true); setQuery(""); setCursor(0); }, []);
  const closePalette = useCallback(() => { setOpen(false); setQuery(""); }, []);

  // ── Global key listeners ────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      // Cmd+K / Ctrl+K → open palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        open ? closePalette() : openPalette();
        return;
      }
      // Escape → close
      if (e.key === "Escape" && open) { closePalette(); return; }
      // Alt+letter shortcuts (when palette is closed)
      if (!open && e.altKey && ALT_SHORTCUTS[e.key]) {
        e.preventDefault();
        navigate(ALT_SHORTCUTS[e.key]);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, openPalette, closePalette, navigate]);

  // ── Focus input when open ────────────────────────────────────────────────
  useEffect(() => {
    if (open && inputRef.current) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // ── Filtered commands ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!query.trim()) return ALL_COMMANDS;
    const q = query.toLowerCase();
    return ALL_COMMANDS.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.group.toLowerCase().includes(q)
    );
  }, [query]);

  // ── Group results ─────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach(c => {
      if (!g[c.group]) g[c.group] = [];
      g[c.group].push(c);
    });
    return g;
  }, [filtered]);

  // Flat list for cursor navigation
  const flat = filtered;

  // ── Keyboard navigation inside palette ──────────────────────────────────
  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(c => Math.min(c + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(c => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flat[cursor]) runCommand(flat[cursor]);
    }
  };

  // Keep cursor item visible
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${cursor}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  // Reset cursor on query change
  useEffect(() => { setCursor(0); }, [query]);

  // ── Run a command ─────────────────────────────────────────────────────────
  const runCommand = useCallback((cmd) => {
    closePalette();
    if (cmd.path) {
      navigate(cmd.path);
      return;
    }
    if (cmd.action === "logout") {
      localStorage.removeItem("admin-token");
      localStorage.removeItem("admin-roles");
      localStorage.removeItem("admin-name");
      window.location.href = "/login";
      return;
    }
    if (cmd.action === "refresh") { window.location.reload(); return; }
    if (cmd.action === "fullscreen") {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    }
  }, [closePalette, navigate]);

  if (!open) return null;

  let globalIdx = 0;

  return (
    <div className="cp-backdrop" onClick={closePalette}>
      <div className="cp-panel" onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="cp-input-row">
          <span className="cp-search-icon">⌘</span>
          <input
            ref={inputRef}
            className="cp-input"
            type="text"
            placeholder="Search commands, pages, actions…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <kbd className="cp-esc" onClick={closePalette}>ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="cp-results">
          {flat.length === 0 && (
            <div className="cp-empty">No commands match "{query}"</div>
          )}
          {Object.entries(grouped).map(([group, cmds]) => (
            <div key={group} className="cp-group">
              <div className="cp-group-label">{group}</div>
              {cmds.map(cmd => {
                const idx = globalIdx++;
                const isActive = cursor === idx;
                // find this command's actual flat index
                const flatIdx = flat.indexOf(cmd);
                return (
                  <div
                    key={cmd.id}
                    data-index={flatIdx}
                    className={`cp-item ${flat[cursor]?.id === cmd.id ? "active" : ""}`}
                    onClick={() => runCommand(cmd)}
                    onMouseEnter={() => setCursor(flatIdx)}
                  >
                    <span className="cp-item-icon">{cmd.icon}</span>
                    <span className="cp-item-label">{highlightMatch(cmd.label, query)}</span>
                    {cmd.path && <span className="cp-item-path">{cmd.path.replace("/admin", "")}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="cp-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>ESC</kbd> close</span>
          <span style={{ marginLeft: "auto" }}>Alt+D/P/T/S for quick nav</span>
        </div>
      </div>
    </div>
  );
};

// ── Highlight matching text ───────────────────────────────────────────────────
function highlightMatch(text, query) {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="cp-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default CommandPalette;
