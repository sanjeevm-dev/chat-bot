export type Message = {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
};

export type ChatSettings = {
  theme: {
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    borderRadius: string;
    fontSize: string;
    position: "bottom-right" | "bottom-left" | "top-right" | "top-left";
    headerFooterBgColor: string;
    inputContainerBgColor: string;
    aiMessageBgColor: string;
    userMessageBgColor: string;
  };
  language: string;
  voiceEnabled: boolean;
  companyName: string;
  companyLogo: string;
  footerLogo?: string;
  prompt: string;
};

export type ChatState = {
  messages: Message[];
  isOpen: boolean;
  settings: ChatSettings;
  addMessage: (message: Message) => void;
  toggleChat: () => void;
  updateSettings: (settings: Partial<ChatSettings>) => void;
  clearMessages: () => void;
};
