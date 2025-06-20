import React, { useState, useRef, useEffect } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { Button, Input, Space, Avatar, Tooltip, message } from "antd";
import {
  MessageOutlined,
  SendOutlined,
  CloseOutlined,
  RobotOutlined,
  UserOutlined,
  LoadingOutlined,
  SoundOutlined,
} from "@ant-design/icons";
import { useChatStore } from "./chatStore";
import type { Message } from "./types";
import { motion, AnimatePresence } from "framer-motion";
import VoiceAgent from "./VoiceAgent";
import { BrushCleaning } from "lucide-react";

// Cricket-specific prompt

const ChatWidget: React.FC = () => {
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { messages, isOpen, settings, toggleChat, addMessage, clearMessages } =
    useChatStore();

  // On mount, get or create sessionId/userId
  useEffect(() => {
    const storedSessionId = localStorage.getItem("chatSessionId");
    const storedUserId = localStorage.getItem("chatUserId");
    if (storedSessionId && storedUserId) {
      setSessionId(storedSessionId);
      setUserId(storedUserId);
    } else {
      fetch("/api/chat/sessions", { method: "POST" })
        .then((res) => res.json())
        .then(({ sessionId, userId }) => {
          setSessionId(sessionId);
          setUserId(userId);
          localStorage.setItem("chatSessionId", sessionId);
          localStorage.setItem("chatUserId", userId);
        });
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Call backend API for Gemini response
  const getGeminiResponse = async (
    userMessage: string,
    messages: { sender: string; content: string }[],
    CRICKET_PROMPT: string
  ) => {
    if (!sessionId || !userId) throw new Error("No session or user ID");
    try {
      const res = await fetch("/api/chat/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          messages,
          prompt: CRICKET_PROMPT,
          sessionId,
          userId,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to get response from Gemini");
      }
      const data = await res.json();
      return data.response;
    } catch (error) {
      console.error("Error getting Gemini response:", error);
      throw new Error(
        "Failed to get response from Gemini. Please try again later."
      );
    }
  };

  const handleSendMessage = async () => {
    if (inputMessage.trim()) {
      const newMessage: Message = {
        id: Date.now().toString(),
        content: inputMessage,
        sender: "user",
        timestamp: new Date(),
      };
      addMessage(newMessage);
      setInputMessage("");

      setIsTyping(true);

      try {
        const response = await getGeminiResponse(
          inputMessage,
          messages,
          settings?.prompt
        );

        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: response,
          sender: "bot",
          timestamp: new Date(),
        };
        addMessage(botMessage);

        if (settings.voiceEnabled) {
          playBotSound();
        }
      } catch (error) {
        console.error("Error in chat:", error);
        message.error("Failed to get response. Please try again.");
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: "I apologize, but I encountered an error. Please try again.",
          sender: "bot",
          timestamp: new Date(),
        };
        addMessage(errorMessage);
      } finally {
        setIsTyping(false);
      }
    }
  };

  const playBotSound = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio("/bot-sound.mp3");
    }
    setIsPlaying(true);
    audioRef.current.play();
    audioRef.current.onended = () => setIsPlaying(false);
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getPositionStyles = () => {
    const { position } = settings.theme;
    const positions: Record<typeof position, string> = {
      "bottom-right": "bottom-4 right-4 flex-col items-end",
      "bottom-left": "bottom-4 left-4 flex-col items-start",
      "top-right": "top-4 right-4 flex-col-reverse items-end",
      "top-left": "top-4 left-4 flex-col-reverse items-start",
    };
    return positions[position];
  };

  const handleClearChat = () => {
    clearMessages();
    message.success("Chat history cleared");
  };

  return (
    <div
      className={`fixed z-50 flex ${getPositionStyles()}`}
      style={{ maxWidth: 400 }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        whileHover={{ scale: 1.1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        style={{ zIndex: 100 }}
      >
        <Tooltip
          title={isOpen ? "Close chat" : `Chat with ${settings.companyName}`}
        >
          <Button
            type="primary"
            shape="circle"
            size="large"
            icon={
              isOpen ? (
                <CloseOutlined style={{ fontSize: 28, color: "#ffffff" }} />
              ) : (
                <MessageOutlined style={{ fontSize: 24, color: "#ffffff" }} />
              )
            }
            onClick={toggleChat}
            className="shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center"
            style={{
              backgroundColor: settings.theme.primaryColor,
              boxShadow: `0 4px 12px ${settings.theme.primaryColor}40`,
              width: 56,
              height: 56,
              fontSize: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          />
        </Tooltip>
      </motion.div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 30 }}
            className="chat-window shadow-2xl rounded-2xl overflow-hidden border border-gray-200"
            style={{
              backgroundColor: settings.theme.backgroundColor,
              borderRadius: settings.theme.borderRadius,
              width: "380px",
              height: "600px",
              display: "flex",
              flexDirection: "column",
              marginTop: settings.theme.position.startsWith("top") ? 0 : 16,
              marginBottom: settings.theme.position.startsWith("bottom")
                ? 0
                : 16,
            }}
          >
            <>
              <motion.div
                className="flex justify-between items-center p-4 border-b"
                style={{
                  borderTopLeftRadius: settings.theme.borderRadius,
                  borderTopRightRadius: settings.theme.borderRadius,
                  background: settings.theme.headerFooterBgColor,
                  color: settings.theme.textColor,
                }}
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <div className="flex items-center space-x-3">
                  <span
                    style={{
                      background: settings.theme.headerFooterBgColor,
                      borderRadius: "9999px",
                      padding: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src={settings.companyLogo}
                      alt="logo"
                      className="w-8 h-8 rounded-full border border-gray-200"
                    />
                  </span>
                  <span
                    className="font-semibold text-base"
                    style={{ color: settings.theme.textColor }}
                  >
                    {settings.companyName}
                  </span>
                </div>
                <Tooltip title="Clear chat history">
                  <Button
                    type="text"
                    icon={<BrushCleaning size={20} />}
                    onClick={handleClearChat}
                    className={`hover:bg-gray-200 rounded-full`}
                    style={{
                      color: "white",
                      backgroundColor: settings.theme.primaryColor,
                    }}
                  />
                </Tooltip>
              </motion.div>

              <div
                className="flex-1 overflow-y-auto p-4 space-y-4"
                style={{
                  fontSize: settings.theme.fontSize,
                  backgroundColor: settings.theme.backgroundColor,
                  color: settings.theme.textColor,
                }}
              >
                <AnimatePresence>
                  {messages.map((message: Message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 25,
                      }}
                      className={`flex ${
                        message.sender === "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className="max-w-[80%] rounded-xl p-2 shadow-sm "
                        style={{
                          fontSize: settings.theme.fontSize,
                          color:
                            message.sender === "user"
                              ? settings.theme.aiMessageBgColor
                              : settings.theme.textColor,
                          borderRadius: settings.theme.borderRadius,
                          background:
                            message.sender === "user"
                              ? settings.theme.userMessageBgColor
                              : settings.theme.aiMessageBgColor,
                        }}
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-center space-x-2 mb-1">
                            <div className="flex items-center space-x-2">
                              <Avatar
                                icon={
                                  message.sender === "user" ? (
                                    <UserOutlined />
                                  ) : (
                                    <RobotOutlined />
                                  )
                                }
                                size="small"
                                style={{
                                  backgroundColor:
                                    message.sender === "user"
                                      ? "#ffffff"
                                      : settings.theme.primaryColor,
                                  color:
                                    message.sender === "user"
                                      ? settings.theme.primaryColor
                                      : "#ffffff",
                                }}
                              />
                              <span
                                className="text-xs opacity-75"
                                style={{
                                  color:
                                    message.sender === "user"
                                      ? "#ffffff"
                                      : settings.theme.textColor,
                                }}
                              >
                                {message.sender === "user"
                                  ? "You"
                                  : settings.companyName}
                              </span>
                            </div>
                            <div>
                              <span
                                className="text-xs opacity-75 mt-1 block mx-auto"
                                style={{
                                  color:
                                    message.sender === "user"
                                      ? "#ffffff"
                                      : settings.theme.textColor,
                                }}
                              >
                                {new Date(
                                  message.timestamp
                                ).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                          <p
                            className="text-sm"
                            style={{ fontSize: settings.theme.fontSize }}
                          >
                            {message.content}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center space-x-2"
                    style={{ color: settings.theme.textColor }}
                  >
                    <LoadingOutlined
                      className="animate-spin"
                      style={{
                        fontSize: `calc(${settings.theme.fontSize} * 1.5)`,
                        color: settings.theme.textColor,
                      }}
                    />
                    <span>{settings.companyName} is typing...</span>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <motion.div
                className="p-4 border-t"
                style={{
                  background: settings.theme.inputContainerBgColor,
                  borderTop: `1px solid ${settings.theme.headerFooterBgColor}`,
                }}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Space.Compact style={{ width: "100%" }}>
                  <Input
                    value={inputMessage}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setInputMessage(e.target.value)
                    }
                    onKeyDown={handleKeyPress}
                    placeholder={`Type your message to ${settings.companyName}...`}
                    className="rounded-l-lg"
                    style={{
                      fontSize: settings.theme.fontSize,
                      color: settings.theme.textColor,
                      backgroundColor: settings.theme.backgroundColor,
                      height: 44,
                    }}
                  />
                  {settings.voiceEnabled && (
                    <Tooltip title="Voice Agent">
                      <VoiceAgent
                        messages={messages}
                        setMessages={addMessage}
                        shouldStartCall={isVoiceMode}
                        setShouldStartCall={setIsVoiceMode}
                        setGenerating={setIsTyping}
                        prompt={settings.prompt}
                      />
                    </Tooltip>
                  )}
                  <Tooltip title="Send Message">
                    <Button
                      type="primary"
                      icon={
                        <SendOutlined
                          style={{
                            fontSize: settings.theme.fontSize,
                            color: "#ffffff",
                          }}
                        />
                      }
                      onClick={handleSendMessage}
                      className="rounded-r-lg transition-all duration-300"
                      style={{
                        backgroundColor: settings.theme.primaryColor,
                        height: 44,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    />
                  </Tooltip>
                </Space.Compact>

                {settings.voiceEnabled && isPlaying && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center space-x-2 mt-2"
                    style={{ color: settings.theme.textColor }}
                  >
                    <SoundOutlined
                      className="animate-pulse"
                      style={{
                        fontSize: `calc(${settings.theme.fontSize} * 1.5)`,
                        color: settings.theme.textColor,
                      }}
                    />
                    <span>Playing response...</span>
                  </motion.div>
                )}
              </motion.div>

              <div
                className="w-full text-center py-2 border-t flex items-center justify-center gap-2"
                style={{
                  borderBottomLeftRadius: settings.theme.borderRadius,
                  borderBottomRightRadius: settings.theme.borderRadius,
                  background: settings.theme.headerFooterBgColor,
                  color: settings.theme.textColor,
                  fontSize: settings.theme.fontSize,
                }}
              >
                <span
                  style={{
                    background: settings.theme.headerFooterBgColor,
                    borderRadius: "9999px",
                    padding: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src={settings.footerLogo || settings.companyLogo}
                    alt="logo"
                    className="w-4 h-4 rounded-full inline-block mr-1"
                  />
                </span>
                Built on{" "}
                <span className="font-semibold mx-1">
                  {settings.companyName}
                </span>
              </div>
            </>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatWidget;
