import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_URL } from "../api/config";
import { useAuth } from "../context/AuthContext";
import { TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";
import { subscribeChatWidget } from "../utils/chatWidgetBus";
import { getActiveRouteName, subscribeActiveRoute } from "../navigation/activeRoute";

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

const titleFromMessage = (text) =>
  text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX).trim()}…` : text;

export default function ChatWidget() {
  const { userToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState([makeSession()]);
  const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(false);
  const [routeName, setRouteName] = useState(getActiveRouteName());
  const scrollRef = useRef(null);

  // The Home hero has its own chat icon (next to the profile avatar) that
  // publishes here instead of rendering a second entry point on that screen.
  useEffect(() => subscribeChatWidget(() => setOpen(true)), []);
  useEffect(() => subscribeActiveRoute(setRouteName), []);

  // Wait a couple seconds after login before showing the FAB, so it doesn't
  // pop in immediately on top of the home screen's own load-in animations.
  useEffect(() => {
    if (!userToken) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 5000);
    return () => clearTimeout(timer);
  }, [userToken]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          setActiveId(parsed[0].id);
        } else {
          const s = makeSession();
          setSessions([s]);
          setActiveId(s.id);
        }
      } catch {
        const s = makeSession();
        setSessions([s]);
        setActiveId(s.id);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(-MAX_SESSIONS)));
  }, [sessions, loaded]);

  const activeSession = sessions.find((s) => s.id === activeId) || sessions[0];

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

  const closeTab = (id) => {
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
    if (!text || sending || !activeSession) return;

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
      const res = await fetch(`${BASE_URL}/chatbot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
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

  if (!userToken || !visible || !loaded || !activeSession) return null;

  return (
    <>
      {routeName !== "HomeScreen" && (
        <TouchableOpacity style={styles.fab} onPress={() => setOpen(true)} activeOpacity={0.85}>
          <View style={styles.fabBubble}>
            <View style={styles.fabBubbleTail} />
          </View>
        </TouchableOpacity>
      )}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.panel}
          >
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>GoodSoles Assistant</Text>
                <Text style={styles.headerSubtitle}>Usually replies in seconds</Text>
              </View>
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsContent}>
              {sessions.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.tab, s.id === activeId && styles.tabActive]}
                  onPress={() => setActiveId(s.id)}
                >
                  <Text style={[styles.tabLabel, s.id === activeId && styles.tabLabelActive]} numberOfLines={1}>
                    {s.title}
                  </Text>
                  {sessions.length > 1 && (
                    <TouchableOpacity onPress={() => closeTab(s.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.tabClose}>✕</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.tabNew} onPress={newChat}>
                <Text style={styles.tabNewText}>+</Text>
              </TouchableOpacity>
            </ScrollView>

            <ScrollView
              ref={scrollRef}
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              {activeSession.messages.map((m, i) => (
                <View
                  key={i}
                  style={[styles.bubble, m.role === "user" ? styles.bubbleUser : styles.bubbleAssistant]}
                >
                  <Text style={m.role === "user" ? styles.bubbleTextUser : styles.bubbleTextAssistant}>
                    {m.content}
                  </Text>
                </View>
              ))}
              {sending && (
                <View style={[styles.bubble, styles.bubbleAssistant]}>
                  <ActivityIndicator size="small" color="#a0a0a0" />
                </View>
              )}
              {!!error && <Text style={styles.error}>{error}</Text>}
            </ScrollView>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder="Type your question..."
                placeholderTextColor="#666"
                multiline
                onSubmitEditing={send}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
                onPress={send}
                disabled={!input.trim() || sending}
              >
                <Text style={styles.sendBtnText}>➤</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 18,
    // Clears the floating glass-pill nav — same clearance every screen
    // pads its own bottom content by, plus a small visible gap above it.
    bottom: TAB_BAR_CLEARANCE + 8,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#c5a059",
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    zIndex: 999,
  },
  fabBubble: { width: 22, height: 16, borderWidth: 1.8, borderColor: "#0a0a0a", borderRadius: 3 },
  fabBubbleTail: {
    position: "absolute",
    bottom: -6,
    left: 4,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#0a0a0a",
  },

  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  panel: { height: "82%", backgroundColor: "#151515", borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  headerSubtitle: { color: "#a0a0a0", fontSize: 12, marginTop: 2 },
  closeBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  closeBtnText: { color: "#a0a0a0", fontSize: 16 },

  tabs: { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  tabsContent: { paddingHorizontal: 10, alignItems: "center", gap: 8 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    maxWidth: 140,
  },
  tabActive: { backgroundColor: "rgba(197,160,89,0.18)" },
  tabLabel: { color: "#888", fontSize: 12 },
  tabLabelActive: { color: "#e2c28d" },
  tabClose: { color: "#666", fontSize: 11 },
  tabNew: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  tabNewText: { color: "#fff", fontSize: 16, marginTop: -2 },

  body: { flex: 1 },
  bodyContent: { padding: 14, gap: 10 },
  bubble: { maxWidth: "82%", borderRadius: 14, paddingHorizontal: 13, paddingVertical: 9 },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: "#c5a059" },
  bubbleAssistant: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.06)" },
  bubbleTextUser: { color: "#0a0a0a", fontSize: 14, lineHeight: 20 },
  bubbleTextAssistant: { color: "#eee", fontSize: 14, lineHeight: 20 },
  error: { color: "#e5484d", fontSize: 12, marginTop: 4 },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  input: {
    flex: 1,
    maxHeight: 100,
    color: "#fff",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#c5a059",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: "#0a0a0a", fontSize: 16 },
});
