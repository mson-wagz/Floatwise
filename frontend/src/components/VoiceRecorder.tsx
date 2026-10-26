import { useRef, useState } from "react";

export default function VoiceRecorder({ onDone }: { onDone: (blob: Blob) => void }) {
  const [recording, setRecording] = useState(false);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    rec.current = new MediaRecorder(stream);
    chunks.current = [];
    rec.current.ondataavailable = (e) => chunks.current.push(e.data);
    rec.current.onstop = () => onDone(new Blob(chunks.current, { type: "audio/webm" }));
    rec.current.start();
    setRecording(true);
  }
  function stop() {
    rec.current?.stop();
    setRecording(false);
  }
  return (
    <button onClick={recording ? stop : start} className="rounded-full px-6 py-3 border">
      {recording ? "Stop" : "Record voice note"}
    </button>
  );
}