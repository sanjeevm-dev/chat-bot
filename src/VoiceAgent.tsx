import React, { useState, useEffect, useRef } from "react";
import { Mic } from "lucide-react";
type Message = {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
};

interface VoiceAgentProps {
  messages: Message[];
  setMessages: (message: Message) => void;
  shouldStartCall: boolean;
  setShouldStartCall: (val: boolean) => void;
  setGenerating: (val: boolean) => void;
  prompt?: string;
}

const VoiceAgent: React.FC<VoiceAgentProps> = ({
  messages,
  setMessages,
  shouldStartCall,
  setShouldStartCall,
  setGenerating,
  prompt,
}) => {
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioCtxRef = useRef<AudioContext | null>(null);
  const aiSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const aiTranscriptRef = useRef("");

  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [callActive, setCallActive] = useState(false);

  const endCall = async () => {
    setGenerating(false);
    setIsAiSpeaking(false);
    setShouldStartCall(false);

    if (peerConnectionRef.current) {
      peerConnectionRef.current.getSenders().forEach((s) => s.track?.stop());
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (dataChannelRef.current?.readyState === "open") {
      dataChannelRef.current.close();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.srcObject = null;
    }

    if (aiSourceRef.current) {
      aiSourceRef.current.disconnect();
      aiSourceRef.current = null;
    }

    await remoteAudioCtxRef.current?.close();
    remoteAudioCtxRef.current = null;

    setCallActive(false);
  };

  const startCall = async () => {
    try {
      setGenerating(true);

      const tokenRes = await fetch("/api/voice/token", { method: "POST" });
      const { client_secret } = await tokenRes.json();
      const EPHEMERAL_KEY = client_secret.value;

      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const [audioTrack] = streamRef.current.getTracks();
      pc.addTrack(audioTrack);

      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;

      dc.onopen = () => {
        const payload = {
          type: "session.update",
          session: {
            instructions: `Speak in a warm, clear and strong Indian accent. Keep conversation friendly and educational.\n\n\n+${prompt}`,
            input_audio_transcription: {
              model: "whisper-1",
            },
          },
        };
        dc.send(JSON.stringify(payload));
      };

      dc.onmessage = (e) => {
        const event = JSON.parse(e.data);
        const { type, transcript, text, delta } = event;

        if (type === "conversation.item.input_audio_transcription.completed") {
          const userMsg = transcript || text;
          if (userMsg) {
            setMessages({
              id: Date.now().toString(),
              content: userMsg,
              sender: "user",
              timestamp: new Date(),
            });
          }
        }

        if (type === "response.audio_transcript.delta") {
          aiTranscriptRef.current += delta;
        }

        if (type === "response.audio_transcript.done") {
          const finalText = aiTranscriptRef.current.trim();
          if (finalText) {
            setMessages({
              id: (Date.now() + 1).toString(),
              content: finalText,
              sender: "bot",
              timestamp: new Date(),
            });
          }
          aiTranscriptRef.current = "";
        }
      };

      pc.ontrack = (e) => {
        const remoteStream = e.streams[0];
        if (audioRef.current) {
          audioRef.current.srcObject = remoteStream;
          audioRef.current.volume = 1.0;
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              console.error("Audio playback error:", err);
              if (remoteAudioCtxRef.current?.state === "suspended") {
                remoteAudioCtxRef.current.resume();
              }
            });
          }
        }

        const audioCtx = new AudioContext();
        remoteAudioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(remoteStream);
        aiSourceRef.current = source;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const interval = setInterval(() => {
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setIsAiSpeaking(avg > 10);
        }, 300);

        remoteStream.getTracks().forEach((track) =>
          track.addEventListener("ended", () => {
            clearInterval(interval);
            setIsAiSpeaking(false);
          })
        );
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await fetch(
        "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${EPHEMERAL_KEY}`,
            "Content-Type": "application/sdp",
          },
        }
      );

      const answer = { type: "answer", sdp: await res.text() };
      await pc.setRemoteDescription(answer as RTCSessionDescription);

      setCallActive(true);
      setGenerating(false);
    } catch (err) {
      console.error("Start call error:", err);
      setGenerating(false);
      endCall();
    }
  };

  useEffect(() => {
    if (shouldStartCall && !callActive) {
      startCall();
    }
    if (!shouldStartCall && callActive) {
      endCall();
    }

    return () => {
      endCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldStartCall]);

  return (
    <>
      <button
        onClick={() => (callActive ? endCall() : setShouldStartCall(true))}
        className={`rounded-none transition-all duration-300 border-none p-2 ${
          callActive ? "bg-red-500" : "bg-green-500"
        }`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {callActive && isAiSpeaking ? (
          <div className="flex items-end space-x-1 h-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-[3px] h-full bg-white rounded-sm animate-voice-pulse"
                style={{
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: "1s",
                }}
              />
            ))}
          </div>
        ) : (
          <Mic className="h-6 w-6 text-white" />
        )}
      </button>
      <audio
        ref={audioRef}
        autoPlay
        playsInline
        style={{ display: "none" }}
        controls={false}
      />
    </>
  );
};

export default VoiceAgent;
