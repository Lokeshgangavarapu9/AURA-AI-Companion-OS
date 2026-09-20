/**
 * AURA AI Companion OS — Frontend Microphone & Browser Audio Service
 * Client-side audio bridge capturing MediaRecorder PCM/Opus chunks and streaming via WebSocket.
 */

export interface MicrophoneServiceConfig {
  wsUrl: string;
  sampleRate?: number;
  timeSliceMs?: number;
}

export class MicrophoneService {
  private mediaStream?: MediaStream;
  private mediaRecorder?: MediaRecorder;
  private ws?: WebSocket;
  private config: MicrophoneServiceConfig;
  private isRecording = false;
  private currentSessionId?: string;
  private onMessageCallback?: (data: any) => void;
  private recognition?: any;
  private usingBrowserRecognition = false;

  constructor(config: Partial<MicrophoneServiceConfig> = {}) {
    this.config = {
      wsUrl: config.wsUrl || 'ws://localhost:5000/ws/voice',
      sampleRate: config.sampleRate || 16000,
      timeSliceMs: config.timeSliceMs || 250,
    };
  }

  public setOnMessageCallback(cb: (data: any) => void): void {
    this.onMessageCallback = cb;
  }

  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.wsUrl);

        this.ws.onopen = () => {
          console.log('🎙️ MicrophoneService: WebSocket connection established');
          resolve();
        };

        this.ws.onerror = (err) => {
          console.error('❌ MicrophoneService: WebSocket connection error', err);
          reject(err);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'SESSION_STARTED' && data.sessionId) {
              this.currentSessionId = data.sessionId;
            }
            if (this.onMessageCallback) {
              this.onMessageCallback(data);
            }
          } catch (err) {
            console.error('❌ MicrophoneService: Failed to parse WS message', err);
          }
        };

        this.ws.onclose = () => {
          console.log('🎙️ MicrophoneService: WebSocket connection closed');
          this.stopRecording();
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  public async startRecording(conversationSessionId?: string): Promise<void> {
    if (this.isRecording) return;

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }

    // Send START_SESSION frame
    this.ws?.send(
      JSON.stringify({
        type: 'START_SESSION',
        conversationSessionId,
        sampleRate: this.config.sampleRate,
      })
    );

    // Prefer the browser recognizer when present. It provides real transcripts
    // without pretending WebM/Opus is PCM for a server-side STT provider.
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (Recognition) {
      this.usingBrowserRecognition = true;
      this.isRecording = true;
      this.recognition = new Recognition();
      this.recognition.lang = 'en-US';
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const text = result[0]?.transcript?.trim();
          if (text && result.isFinal && this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'TRANSCRIPTION', sessionId: this.currentSessionId, text, isFinal: true }));
          }
        }
      };
      this.recognition.onerror = (event: any) => console.warn('Speech recognition error', event.error);
      this.recognition.onend = () => {
        if (this.isRecording && this.usingBrowserRecognition) {
          try { this.recognition.start(); } catch { /* recognition is already restarting */ }
        }
      };
      this.recognition.start();
      console.log('MicrophoneService: started continuous browser speech recognition');
      return;
    }

    // Capture User Microphone
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: this.config.sampleRate,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    this.mediaRecorder = new MediaRecorder(this.mediaStream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm',
    });

    this.mediaRecorder.ondataavailable = async (event: BlobEvent) => {
      if (event.data.size > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
        const arrayBuffer = await event.data.arrayBuffer();
        const base64 = this.arrayBufferToBase64(arrayBuffer);

        this.ws.send(
          JSON.stringify({
            type: 'AUDIO_CHUNK',
            audioBase64: base64,
            sessionId: this.currentSessionId,
          })
        );
      }
    };

    // Web Audio Voice Activity Detection (VAD) Engine
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(this.mediaStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let silenceStart = Date.now();
      let isSpeaking = false;

      const vadInterval = setInterval(() => {
        if (!this.isRecording) {
          clearInterval(vadInterval);
          audioCtx.close();
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        // VAD Energy Threshold (~15)
        if (average > 15) {
          if (!isSpeaking) {
            isSpeaking = true;
            console.log('🎙️ VAD: User started speaking');
          }
          silenceStart = Date.now();
        } else {
          // Silence timeout (1.2s after user spoke)
          if (isSpeaking && Date.now() - silenceStart > 1200) {
            isSpeaking = false;
            console.log('🎙️ VAD: Speech ended — auto triggering turn completion');
            this.sendEndSpeech();
          }
        }
      }, 100);
    } catch (vadErr) {
      console.warn('⚠️ MicrophoneService: Web Audio VAD fallback blip', vadErr);
    }

    this.mediaRecorder.start(this.config.timeSliceMs);
    this.isRecording = true;
    console.log('🎙️ MicrophoneService: Started microphone audio capture stream with VAD');
  }

  public stopRecording(): void {
    if (!this.isRecording) return;

    const wasUsingBrowserRecognition = this.usingBrowserRecognition;

    if (this.recognition) {
      this.usingBrowserRecognition = false;
      try { this.recognition.stop(); } catch { /* already stopped */ }
      this.recognition = undefined;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
    }

    if (!wasUsingBrowserRecognition && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'END_SPEECH',
          sessionId: this.currentSessionId,
        })
      );
    }

    this.isRecording = false;
    console.log('⏹️ MicrophoneService: Stopped microphone audio capture');
  }

  public sendEndSpeech(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'END_SPEECH',
          sessionId: this.currentSessionId,
        })
      );
    }
  }

  public interrupt(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'INTERRUPT',
          sessionId: this.currentSessionId,
          reason: 'User manual barge-in',
        })
      );
    }
  }

  public disconnect(): void {
    this.stopRecording();
    if (this.ws) {
      this.ws.close();
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
