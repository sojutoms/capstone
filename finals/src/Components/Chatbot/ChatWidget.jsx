import React, { useEffect, useRef, useState } from "react";
import "./ChatWidget.css";
import API_BASE_URL from "../../services/api";

const STORAGE_KEY = "gs_chat_sessions";
const MAX_SESSIONS = 20;
const TITLE_MAX = 28;

const WELCOME_MESSAGE = {
  role: "assistant",
  content: "Hi! I'm the GoodSoles PH assistant. Ask me about shipping, orders, returns, or anything else — how can I help?",
};

const makeSession = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: "New Chat",
  messages: [WELCOME_MESSAGE],
});

const loadSessions = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // fall through to a fresh session
  }
  return [makeSession()];
};

const titleFromMessage = (text) =>
  text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX).trim()}…` : text;

const ChatBubbleIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
    <path d="M4 4h16v12H8l-4 4V4z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

const ChatWidget = () => {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState(loadSessions);
  const [activeId, setActiveId] = useState(() => sessions[0].id);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const activeSession = sessions.find((s) => s.id === activeId) || sessions[0];

  // Lets other parts of the site (e.g. Contact Us's "Start Chat" button)
  // open this same global widget instead of duplicating a chat UI.
  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("open-chatbot", handleOpen);
    return () => window.removeEventListener("open-chatbot", handleOpen);
  }, []);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
      inputRef.current?.focus();
    }
  }, [open, activeId, activeSession?.messages]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(-MAX_SESSIONS)));
  }, [sessions]);

  const updateActiveMessages = (updater) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === activeId ? { ...s, messages: updater(s.messages) } : s))
    );
  };

  const newChat = () => {
    const session = makeSession();
    setSessions((prev) => [...prev, session].slice(-MAX_SESSIONS));
    setActiveId(session.id);
    setError("");
  };

  const closeTab = (id, e) => {
    e.stopPropagation();
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      if (remaining.length === 0) {
        const fresh = makeSession();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) setActiveId(remaining[remaining.length - 1].id);
      return remaining;
    });
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const nextMessages = [...activeSession.messages, { role: "user", content: text }];
    const isFirstUserMessage = !activeSession.messages.some((m) => m.role === "user");

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeId
          ? { ...s, messages: nextMessages, title: isFirstUserMessage ? titleFromMessage(text) : s.title }
          : s
      )
    );
    setInput("");
    setError("");
    setSending(true);

    try {
      const res = await fetch(`${API_BASE_URL}/chatbot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await res.json();
      if (data.success) {
        updateActiveMessages((msgs) => [...msgs, { role: "assistant", content: data.reply }]);
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      <button
        className={`chat-fab ${open ? "chat-fab--hidden" : ""}`}
        onClick={() => setOpen(true)}
        aria-label="Open chat"
      >
        <ChatBubbleIcon />
      </button>

      <div className={`chat-panel ${open ? "chat-panel--open" : ""}`}>
        <div className="chat-panel-header">
          <div>
            <p className="chat-panel-title">GoodSoles Assistant</p>
            <p className="chat-panel-subtitle">Usually replies in seconds</p>
          </div>
          <button className="chat-panel-close" onClick={() => setOpen(false)} aria-label="Close chat">
            <CloseIcon />
          </button>
        </div>

        <div className="chat-tabs">
          {sessions.map((s) => (
            <button
              key={s.id}
              className={`chat-tab ${s.id === activeId ? "chat-tab--active" : ""}`}
              onClick={() => setActiveId(s.id)}
              title={s.title}
            >
              <span className="chat-tab-label">{s.title}</span>
              {sessions.length > 1 && (
                <span className="chat-tab-close" onClick={(e) => closeTab(s.id, e)} aria-label="Close chat tab">
                  <CloseIcon />
                </span>
              )}
            </button>
          ))}
          <button className="chat-tab-new" onClick={newChat} aria-label="New chat">
            <PlusIcon />
          </button>
        </div>

        <div className="chat-panel-body">
          {activeSession.messages.map((m, i) => (
            <div key={i} className={`chat-bubble chat-bubble--${m.role}`}>
              {m.content}
            </div>
          ))}
          {sending && (
            <div className="chat-bubble chat-bubble--assistant chat-bubble--typing">
              <span></span><span></span><span></span>
            </div>
          )}
          {error && <div className="chat-error">{error}</div>}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-panel-input">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your question..."
            rows={1}
          />
          <button onClick={send} disabled={sending || !input.trim()} aria-label="Send message">
            <SendIcon />
          </button>
        </div>
      </div>
    </>
  );
};

export default ChatWidget;
