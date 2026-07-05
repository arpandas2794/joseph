import React, { useRef, useState, useEffect } from 'react';
import { Mic, Square } from 'lucide-react';
import { workspaceApi } from '../../lib/api';
import { useCanvasStore } from '../../store/canvasStore';

interface VoiceRecordingModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  // Position is optional - it handles desktop vs mobile default positioning
  defaultPosition?: { x: number; y: number };
}

export default function VoiceRecordingModal({ workspaceId, isOpen, onClose, defaultPosition }: VoiceRecordingModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [processingVoice, setProcessingVoice] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { addNode } = useCanvasStore();

  useEffect(() => {
    if (!isOpen) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
      setProcessingVoice(false);
      setRecordingTime(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone access is required to record voice notes.');
    }
  };

  const stopAndSaveRecording = async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    return new Promise<void>((resolve) => {
      mediaRecorderRef.current!.onstop = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsRecording(false);
        setProcessingVoice(true);
        setVoiceStatus('Uploading audio to cloud...');

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const fileName = `${workspaceId}_${Date.now()}.webm`;

          // 1. Upload to Supabase Storage
          const publicUrl = await workspaceApi.uploadVoiceToStorage(audioBlob, fileName);

          setVoiceStatus('AI is listening... (Transcribing)');

          // 2. Transcribe via Gemini
          const { transcript } = await workspaceApi.transcribeVoice(audioBlob);

          setVoiceStatus('Creating Voice Note card...');

          // 3. Create Voice Node
          const position = defaultPosition || { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 };
          const newNode = {
            id: crypto.randomUUID(),
            type: 'voice',
            position,
            style: { width: 320, height: 280 },
            data: {
              customTitle: 'Voice Note',
              content: transcript,
              metadata: { audioUrl: publicUrl }
            },
          };

          addNode(newNode);
          await workspaceApi.upsertCard(workspaceId, newNode);
          useCanvasStore.getState().setLastSaved(new Date());

          onClose();
        } catch (err: any) {
          console.error('Failed to process voice note:', err);
          alert(`Failed to save voice note: ${err.message}`);
        } finally {
          setProcessingVoice(false);
          mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
          resolve();
        }
      };

      mediaRecorderRef.current!.stop();
    });
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    onClose();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#18181b] border border-purple-500/30 rounded-3xl p-8 w-full max-w-sm shadow-[0_0_50px_-12px_rgba(168,85,247,0.3)] flex flex-col items-center gap-6 relative overflow-hidden">
        {/* Animated background glow during recording */}
        {isRecording && !processingVoice && (
          <div className="absolute inset-0 bg-purple-500/10 animate-pulse pointer-events-none" />
        )}

        <div className="text-center z-10 w-full">
          <h2 className="text-xl font-bold text-white mb-2">Voice Note</h2>
          <p className="text-sm text-gray-400">
            {processingVoice ? 'Processing your voice...' : isRecording ? 'Recording in progress...' : 'Ready to record'}
          </p>
        </div>

        {/* Main Visualizer Area */}
        <div className="relative w-32 h-32 flex items-center justify-center z-10">
          {processingVoice ? (
            <div className="relative flex items-center justify-center">
              <div className="absolute w-24 h-24 border-4 border-purple-500/20 rounded-full" />
              <div className="absolute w-24 h-24 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <Mic className="w-8 h-8 text-purple-400 animate-pulse" />
            </div>
          ) : isRecording ? (
            <div className="flex items-center justify-center gap-1.5 h-16 w-full">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-2 bg-purple-400 rounded-full animate-[wave_1s_ease-in-out_infinite]"
                  style={{
                    height: '100%',
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: `${0.8 + Math.random() * 0.5}s`
                  }}
                />
              ))}
            </div>
          ) : (
            <button
              onClick={startRecording}
              className="w-24 h-24 rounded-full bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95 group"
            >
              <Mic className="w-10 h-10 text-purple-400 group-hover:text-purple-300" />
            </button>
          )}
        </div>

        {/* Timer */}
        <div className="text-3xl font-mono font-light text-white z-10 tracking-widest">
          {formatTime(recordingTime)}
        </div>

        {/* Status / Controls */}
        <div className="w-full flex flex-col gap-3 z-10">
          {processingVoice ? (
            <div className="text-center py-2 text-purple-300 text-sm font-medium animate-pulse">
              {voiceStatus}
            </div>
          ) : isRecording ? (
            <div className="flex gap-3">
              <button
                onClick={cancelRecording}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-3 font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={stopAndSaveRecording}
                className="flex-[2] bg-purple-600 hover:bg-purple-500 text-white rounded-xl py-3 font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Square className="w-4 h-4" fill="currentColor" />
                Finish & Save
              </button>
            </div>
          ) : (
            <button
              onClick={cancelRecording}
              className="w-full bg-white/5 hover:bg-white/10 text-white rounded-xl py-3 font-semibold transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
