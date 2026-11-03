import { useState, useRef, useEffect } from "react";
import { parseVoiceNarration } from "../lib/ingest";
import type { components } from "../api/schema";

type Transaction = components["schemas"]["Transaction"];

interface VoiceRecorderProps {
  onExtracted: (batch: { transactions: Transaction[]; warnings: string[] }) => void;
  currentCash: number;
  currentFloat: number;
}

export default function VoiceRecorder({ onExtracted, currentCash, currentFloat }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "sw-KE"; // Swahili Kenyan voice recognition
      rec.onresult = (e: any) => {
        let current = "";
        for (let i = 0; i < e.results.length; i++) {
          current += e.results[i][0].transcript;
        }
        setTranscript(current);
      };
      rec.onerror = () => {
        setIsRecording(false);
      };
      rec.onend = () => {
        setIsRecording(false);
      };
      recognitionRef.current = rec;
    }
  }, []);

  const startListening = () => {
    setTranscript("");
    setIsRecording(true);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch {
        // Already running or permission prompt
      }
    }
  };

  const stopListening = () => {
    setIsRecording(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (transcript) {
      const result = parseVoiceNarration(transcript, currentCash, currentFloat);
      onExtracted(result);
    }
  };

  const runSampleVoice = (sampleText: string) => {
    setTranscript(sampleText);
    const result = parseVoiceNarration(sampleText, currentCash, currentFloat);
    onExtracted(result);
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-3xl shadow-inner">
          🎙️
        </div>
        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">
          Speak Voice Note (Swahili or English)
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          Say what happened today, e.g. <span className="italic font-medium">"Wateja walitoa elfu kumi na tano, halafu mwingine akaweka elfu tano"</span>
        </p>
      </div>

      {/* Record button & active state */}
      <div className="flex flex-col items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={isRecording ? stopListening : startListening}
          className={`px-8 py-3.5 rounded-full font-bold text-sm transition-all shadow-md flex items-center gap-2.5 ${
            isRecording
              ? "bg-rose-600 hover:bg-rose-700 text-white animate-pulse"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          }`}
        >
          <span className="w-3 h-3 rounded-full bg-white animate-ping"></span>
          <span>{isRecording ? "Stop Recording (Tap to Process)" : "Tap to Speak Voice Note"}</span>
        </button>

        {transcript && (
          <div className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
            <span className="font-semibold text-slate-500">Live Transcript: </span>
            <span>"{transcript}"</span>
          </div>
        )}
      </div>

      {/* Sample Quick Voice Triggers */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
          Or Test with Real Audio Samples:
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              runSampleVoice(
                "Wateja wawili walitoa elfu kumi na tano, halafu mwingine akaweka elfu tano."
              )
            }
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-700 text-left transition-colors"
          >
            🔊 Swahili: "Walitoa elfu 15,000, mwingine akaweka elfu 5,000"
          </button>

          <button
            type="button"
            onClick={() =>
              runSampleVoice(
                "Customer withdrew twenty thousand cash, and deposited ten thousand."
              )
            }
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-700 text-left transition-colors"
          >
            🔊 English: "Withdrew 20,000 cash, deposited 10,000"
          </button>

          <button
            type="button"
            onClick={() =>
              runSampleVoice(
                "Mteja alitoa elfu mia tano taslimu."
              )
            }
            className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100 text-left transition-colors font-medium"
            title="Triggers the anomaly detector for misheard elfu mia tano"
          >
            ⚠️ Test Misheard Anomaly: "Alitoa elfu mia tano" (500,000 vs 5,000)
          </button>
        </div>
      </div>
    </div>
  );
}
