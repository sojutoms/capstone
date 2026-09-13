import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SHOW_EVERYWHERE_KEY = "chat-widget-show-everywhere";

const ChatSettingsContext = createContext();

export const useChatSettings = () => useContext(ChatSettingsContext);

export const ChatSettingsProvider = ({ children }) => {
  const [showEverywhere, setShowEverywhere] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SHOW_EVERYWHERE_KEY).then((stored) => {
      if (stored === "true") setShowEverywhere(true);
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(SHOW_EVERYWHERE_KEY, String(showEverywhere)).catch(() => {});
  }, [showEverywhere]);

  const value = useMemo(() => ({ showEverywhere, setShowEverywhere }), [showEverywhere]);

  return <ChatSettingsContext.Provider value={value}>{children}</ChatSettingsContext.Provider>;
};
