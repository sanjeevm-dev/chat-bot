import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatState, Message, ChatSettings } from "./types";

const defaultSettings: ChatSettings = {
  theme: {
    primaryColor: "#2563eb", // Modern blue
    backgroundColor: "#ffffff",
    textColor: "#1f2937",
    borderRadius: "0.75rem",
    fontSize: "1rem",
    position: "bottom-right" as const,
    headerFooterBgColor: "#f4f4f5",
    inputContainerBgColor: "#f4f4f5",
    aiMessageBgColor: "#f4f4f5",
    userMessageBgColor: "#2563eb",
  },
  language: "en",
  voiceEnabled: true,
  companyName: "exthalpy",
  companyLogo: "https://placehold.co/32x32",
  footerLogo: "https://placehold.co/24x24",
  prompt: `You are a cricket expert assistant. Your role is to:
  1. Provide accurate information about cricket rules, players, teams, and tournaments
  2. Share interesting cricket facts and statistics
  3. Explain cricket terminology and concepts
  4. Discuss current cricket events and news
  5. Answer questions about cricket history and records
  Please keep your responses concise, informative, and engaging. If you're unsure about something, acknowledge it rather than providing incorrect information.`,
};

const initialState = {
  messages: [
    {
      id: "1",
      content: "Hello, how can I help you today?",
      sender: "bot" as const,
      timestamp: new Date(),
    },
  ],
  isOpen: false,
  settings: defaultSettings,
};

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      ...initialState,

      // Actions
      addMessage: (message: Message) =>
        set((state) => ({
          ...state,
          messages: [...state.messages, message],
        })),

      toggleChat: () =>
        set((state) => ({
          ...state,
          isOpen: !state.isOpen,
        })),

      updateSettings: (settings: Partial<ChatSettings>) =>
        set((state) => {
          const newSettings = {
            ...state.settings,
            ...settings,
            theme: {
              ...state.settings.theme,
              ...(settings.theme || {}),
            },
          };
          if (typeof window !== "undefined") {
            localStorage.setItem("chatSettings", JSON.stringify(newSettings));
          }
          return {
            ...state,
            settings: newSettings,
          };
        }),

      clearMessages: () =>
        set((state) => ({
          ...state,
          messages: [],
        })),

      loadSettingsFromStorage: () => {
        if (typeof window !== "undefined") {
          const savedSettings = localStorage.getItem("chatSettings");
          if (savedSettings) {
            set((state) => ({
              ...state,
              settings: JSON.parse(savedSettings),
            }));
          }
        }
      },
    }),
    {
      name: "chat-storage",
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);

export default useChatStore;
