import React, { useEffect, useRef, useState } from 'react';
import { type CrmBookingRecord } from '../data/seedData';
import { backendOrigin, wsUrl } from '../utils/backend';
import { Mic, MicOff, PhoneCall, PhoneOff, Volume2, Calendar } from 'lucide-react';

interface LiveVoiceAgentPanelProps {
  onNewVoiceBooking: (bookings: CrmBookingRecord[]) => void;
}

interface LiveTranscriptEntry {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
}

function float32ToPcm16Base64(float32Array: Float32Array): string {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16Array.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Capture runs in a worklet, not on the main thread: the transcript repaints on every
 * streaming delta, and a ScriptProcessorNode fed by the main thread drops frames under
 * that load, which the recognizer hears as clipped speech.
 */
const CAPTURE_WORKLET_SOURCE = `
class Pcm16Capture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor('growpilot-pcm16-capture', Pcm16Capture);
`;

function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768.0;
  }
  return float32Array;
}

export const LiveVoiceAgentPanel: React.FC<LiveVoiceAgentPanelProps> = ({
  onNewVoiceBooking,
}) => {
  const [callState, setCallState] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [selectedVoice, setSelectedVoice] = useState<string>('Zephyr');
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [allowBargeIn, setAllowBargeIn] = useState<boolean>(false);
  const [liveModelLabel, setLiveModelLabel] = useState<string>('gemini-3.8-live');
  const [lastCallUsage, setLastCallUsage] = useState<{
    audioSecondsIn: number;
    audioSecondsOut: number;
    costUsd: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastVoiceBooking, setLastVoiceBooking] = useState<CrmBookingRecord | null>(null);
  const [transcripts, setTranscripts] = useState<LiveTranscriptEntry[]>([
    {
      id: 'init-voice-note',
      role: 'system',
      text: 'Ready for real-time voice conversation (16kHz PCM mic input · 24kHz audio output · live CRM tool calling). On laptop speakers keep Barge-in off, or the agent hears itself and cuts its own reply.',
      timestamp: 'Ready',
    },
  ]);

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const captureNodeRef = useRef<AudioWorkletNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isMicMutedRef = useRef<boolean>(false);
  const allowBargeInRef = useRef<boolean>(false);
  const pendingAssistantBreakRef = useRef<boolean>(false);

  const appendTranscript = (
    role: 'user' | 'assistant' | 'system',
    text: string,
    options?: { newTurn?: boolean }
  ) => {
    if (!text.trim()) return;
    const forceBreak = options?.newTurn || (role === 'assistant' && pendingAssistantBreakRef.current);
    if (role === 'assistant') pendingAssistantBreakRef.current = false;
    setTranscripts((prev) => {
      const last = prev[prev.length - 1];
      // Streaming deltas arrive mid-sentence ("…your budget" then " in mind?"), so they belong
      // to the bubble already open — but never across a turn boundary the server has closed.
      if (!forceBreak && last && last.role === role && role !== 'system') {
        const glue = /\s$/.test(last.text) || /^\s/.test(text) ? '' : ' ';
        const updated = [...prev];
        updated[updated.length - 1] = { ...last, text: `${last.text}${glue}${text}` };
        return updated;
      }
      return [
        ...prev,
        {
          id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role,
          text,
          timestamp: new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ];
    });
  };

  const stopPlaybackQueue = () => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // ignore already stopped source
      }
    }
    activeSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
  };

  const playPcm24kChunk = (base64Audio: string) => {
    if (!outputAudioCtxRef.current) {
      outputAudioCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    const ctx = outputAudioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const float32Data = base64Pcm16ToFloat32(base64Audio);
    if (float32Data.length === 0) return;

    const audioBuffer = ctx.createBuffer(1, float32Data.length, 24000);
    audioBuffer.getChannelData(0).set(float32Data);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + audioBuffer.duration;
    activeSourcesRef.current.push(source);

    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
    };
  };

  const agentIsSpeaking = () => activeSourcesRef.current.length > 0;

  /**
   * Half-duplex gate. On laptop speakers the microphone records the agent's own voice, the
   * server reads that back as the caller interrupting, and the reply gets cut off
   * mid-sentence — the bug that made every call feel broken. Not uploading audio while the
   * agent talks removes it; Barge-in turns it back on for headphone users.
   */
  const forwardMicFrame = (float32: Float32Array) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (isMicMutedRef.current) return;
    if (!allowBargeInRef.current && agentIsSpeaking()) return;
    ws.send(JSON.stringify({ audio: float32ToPcm16Base64(float32) }));
  };

  const cleanupSession = () => {
    stopPlaybackQueue();

    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch {
        // ignore
      }
      scriptProcessorRef.current = null;
    }

    if (captureNodeRef.current) {
      try {
        captureNodeRef.current.port.close();
        captureNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      captureNodeRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cleanupSession();
    };
  }, []);

  const startLiveVoiceCall = async () => {
    setErrorMessage(null);
    setCallState('connecting');

    try {
      outputAudioCtxRef.current = new AudioContext({ sampleRate: 24000 });
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;

      const ws = new WebSocket(wsUrl('/live?voice=' + encodeURIComponent(selectedVoice)));
      wsRef.current = ws;

      ws.onopen = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          mediaStreamRef.current = stream;

          const settings = stream.getAudioTracks()[0]?.getSettings() ?? {};
          appendTranscript(
            'system',
            settings.echoCancellation
              ? 'Mic open with echo cancellation ON.'
              : 'Mic open but the device gave no echo cancellation — keep Barge-in OFF or wear headphones, otherwise the agent interrupts itself.'
          );

          const inputCtx = new AudioContext({ sampleRate: 16000 });
          inputAudioCtxRef.current = inputCtx;
          const source = inputCtx.createMediaStreamSource(stream);

          const workletUrl = URL.createObjectURL(
            new Blob([CAPTURE_WORKLET_SOURCE], { type: 'text/javascript' })
          );
          try {
            await inputCtx.audioWorklet.addModule(workletUrl);
            const node = new AudioWorkletNode(inputCtx, 'growpilot-pcm16-capture', {
              numberOfOutputs: 1,
              outputChannelCount: [1],
            });
            node.port.onmessage = (event: MessageEvent<Float32Array>) =>
              forwardMicFrame(event.data);
            source.connect(node);
            node.connect(inputCtx.destination);
            captureNodeRef.current = node;
          } catch {
            // No AudioWorklet (plain-HTTP origin on an old browser): ScriptProcessor still
            // streams, just with main-thread frame drops that the recognizer hears as gaps.
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (event) =>
              forwardMicFrame(event.inputBuffer.getChannelData(0));
            source.connect(processor);
            processor.connect(inputCtx.destination);
            scriptProcessorRef.current = processor;
          } finally {
            URL.revokeObjectURL(workletUrl);
          }
        } catch {
          appendTranscript(
            'system',
            'Microphone access unavailable or declined — Live Voice + Quick Prompt mode is still usable: the prompt buttons below send text and you still hear the real-time 24kHz voice reply.'
          );
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'connected') {
            setCallState('connected');
            setLiveModelLabel(String(msg.model));
            appendTranscript(
              'system',
              `Connected to ${msg.model} (Voice: ${msg.voice}). Speak into your microphone or click a quick voice prompt.`
            );
          } else if (msg.type === 'audio' && msg.audio) {
            playPcm24kChunk(msg.audio);
          } else if (msg.type === 'interrupted') {
            stopPlaybackQueue();
          } else if (msg.type === 'turn_complete') {
            // This reply is finished: the next assistant delta opens a new bubble.
            pendingAssistantBreakRef.current = true;
          } else if (msg.type === 'usage') {
            setLastCallUsage({
              audioSecondsIn: msg.audioSecondsIn,
              audioSecondsOut: msg.audioSecondsOut,
              costUsd: msg.costUsd,
            });
          } else if (msg.type === 'transcript' && msg.text) {
            appendTranscript(msg.role === 'user' ? 'user' : 'assistant', msg.text);
          } else if (msg.type === 'crm_booking' && msg.booking) {
            setLastVoiceBooking(msg.booking);
            if (Array.isArray(msg.crmBookings)) {
              onNewVoiceBooking(msg.crmBookings);
            }
            appendTranscript(
              'system',
              `Tool Call Executed (book_discovery_call): Reserved ${msg.booking.bookedSlot} for ${msg.booking.leadName} ($${msg.booking.monthlyBudgetUsd}/mo).`
            );
          } else if (msg.type === 'error') {
            setErrorMessage(msg.message || 'Live voice error occurred.');
            setCallState('error');
          } else if (msg.type === 'closed') {
            setCallState('idle');
          }
        } catch {
          // ignore parse error
        }
      };

      ws.onerror = () => {
        setErrorMessage(
          backendOrigin()
            ? `WebSocket connection to ${backendOrigin()}/live failed.`
            : 'No /live server at this origin — a static host (Vercel) cannot proxy WebSockets. Set the Backend origin in the header, then reload.'
        );
        setCallState('error');
      };

      ws.onclose = () => {
        setCallState((prev) => (prev === 'error' ? 'error' : 'idle'));
      };
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Could not start Gemini Live voice session.'
      );
      setCallState('error');
    }
  };

  const stopLiveVoiceCall = () => {
    cleanupSession();
    setCallState('idle');
    appendTranscript(
      'system',
      lastCallUsage
        ? `Live voice session ended. Measured ${lastCallUsage.audioSecondsIn}s of your speech + ${lastCallUsage.audioSecondsOut}s of agent audio ≈ $${lastCallUsage.costUsd.toFixed(4)} billed.`
        : 'Live voice session ended.'
    );
  };

  const toggleMute = () => {
    const nextMuted = !isMicMutedRef.current;
    isMicMutedRef.current = nextMuted;
    setIsMicMuted(nextMuted);
  };

  const toggleBargeIn = () => {
    const next = !allowBargeInRef.current;
    allowBargeInRef.current = next;
    setAllowBargeIn(next);
    appendTranscript(
      'system',
      next
        ? 'Barge-in ON — your mic keeps streaming while the agent speaks. Works on headphones; on speakers the agent will interrupt itself.'
        : 'Barge-in OFF — mic uploads pause while the agent is talking, so it never hears itself.'
    );
  };

  const sendLiveVoicePrompt = (textPrompt: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    appendTranscript('user', textPrompt, { newTurn: true });
    wsRef.current.send(JSON.stringify({ text: textPrompt }));
  };

  return (
    <section
      aria-label="Gemini Live Real-Time Voice Qualification Agent"
      className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-mono font-semibold text-teal-800">{liveModelLabel}</span>
            <span aria-hidden="true">·</span>
            <span>16kHz PCM Mic Input → 24kHz Audio Output (echo-cancelled)</span>
            <span aria-hidden="true">·</span>
            <span>Live Function Calling to CRM</span>
          </div>
          <h2 className="font-display text-lg font-bold text-slate-900 mt-1">
            Real-Time Voice Qualification & Booking Call (Gemini Live API)
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Speak directly with the GrowPilot voice agent to ask FAQs, qualify your monthly budget, and book a discovery call in real time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div>
            <label htmlFor="live-voice-select" className="sr-only">
              Voice Persona
            </label>
            <select
              id="live-voice-select"
              disabled={callState === 'connected' || callState === 'connecting'}
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg disabled:opacity-60"
            >
              <option value="Zephyr">Voice: Zephyr (Warm Consultant)</option>
              <option value="Kore">Voice: Kore (Clear Executive)</option>
              <option value="Puck">Voice: Puck (Energetic GTM)</option>
              <option value="Fenrir">Voice: Fenrir (Direct & Technical)</option>
              <option value="Charon">Voice: Charon (Calm Specialist)</option>
            </select>
          </div>

          {callState === 'connected' && (
            <button
              type="button"
              onClick={toggleMute}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isMicMuted
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
              }`}
            >
              {isMicMuted ? (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  Unmute Mic
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 text-teal-700" />
                  Mute Mic
                </>
              )}
            </button>
          )}

          {callState === 'connected' || callState === 'connecting' ? (
            <button
              type="button"
              onClick={stopLiveVoiceCall}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              End Live Voice Call
            </button>
          ) : (
            <button
              type="button"
              onClick={startLiveVoiceCall}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              Start Live Voice Call
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="p-3 text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg"
        >
          {errorMessage}
        </div>
      )}

      {/* Quick Spoken Prompts for Active Session */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-500 mr-1">
            Trigger Live Voice Response:
          </span>
          {[
            {
              label: 'Ask Voice Agent About Pricing',
              prompt:
                'Hi! Can you tell me how much your 24/7 WhatsApp AI agent and n8n package costs per month?',
            },
            {
              label: 'Qualify & Book $900/mo Clinic Call',
              prompt:
                'We are SmileCare Dental Clinic in Dhaka with a $900 monthly budget. Please book a discovery call for Tue 22 Oct at 4:00 PM BDT.',
            },
          ].map((item, idx) => (
            <button
              key={idx}
              type="button"
              disabled={callState !== 'connected'}
              onClick={() => sendLiveVoicePrompt(item.prompt)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-teal-50 hover:text-teal-900 disabled:opacity-50 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Volume2 className="w-3 h-3" />
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <label
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 cursor-pointer select-none"
            title="Off = the mic stops uploading while the agent talks, so it cannot hear itself and cut itself off. Turn on only with headphones."
          >
            <input
              type="checkbox"
              checked={allowBargeIn}
              onChange={toggleBargeIn}
              className="w-3.5 h-3.5 accent-teal-700"
            />
            Barge-in
            <span className="text-slate-400">(headphones only)</span>
          </label>

          {lastCallUsage && (
            <span className="text-xs font-mono tabular-nums text-slate-600">
              billed so far ${lastCallUsage.costUsd.toFixed(4)} · {lastCallUsage.audioSecondsOut}s
              agent audio
            </span>
          )}

          <span className="text-xs font-mono tabular-nums text-slate-600">
            Status:{' '}
            <strong className={callState === 'connected' ? 'text-emerald-700' : 'text-slate-800'}>
              {callState.toUpperCase()}
            </strong>
          </span>
        </div>
      </div>

      {/* Live Voice Transcript Stream */}
      <div className="h-40 overflow-y-auto p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
        {transcripts.map((entry) => (
          <div key={entry.id} className="leading-relaxed">
            <span className="font-mono font-semibold text-slate-500 mr-2">
              [{entry.timestamp}]
            </span>
            <span
              className={`font-semibold mr-1.5 ${
                entry.role === 'user'
                  ? 'text-teal-800'
                  : entry.role === 'assistant'
                  ? 'text-slate-900'
                  : 'text-slate-600'
              }`}
            >
              {entry.role === 'user'
                ? 'Caller:'
                : entry.role === 'assistant'
                ? `GrowPilot Voice (${selectedVoice}):`
                : 'Live System:'}
            </span>
            <span className="text-slate-700">{entry.text}</span>
          </div>
        ))}
      </div>

      {lastVoiceBooking && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5 text-xs text-emerald-950">
          <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
          <div>
            <span className="font-semibold">Voice Discovery Call Booked via Live Tool Call: </span>
            {lastVoiceBooking.leadName} ({lastVoiceBooking.businessType}) · $
            {lastVoiceBooking.monthlyBudgetUsd}/mo · {lastVoiceBooking.bookedSlot}
          </div>
        </div>
      )}
    </section>
  );
};
