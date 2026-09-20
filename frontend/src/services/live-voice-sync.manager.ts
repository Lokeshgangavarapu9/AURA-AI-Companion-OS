/**
 * AURA AI Companion OS — Live Voice Conversation & Avatar Sync Manager
 * Client-side orchestrator handling full duplex WebSocket streaming, AudioPlayerService playback,
 * microphone audio capture, immediate barge-in interruption, and avatar state synchronization.
 */

import { MicrophoneService } from './microphone.service.js';
import { AudioPlayerService, audioPlayerService } from './audio-player.service.js';
import { AIStatusMode, AIEmotion } from '../types.js';

export interface LiveVoiceSyncConfig {
  wsUrl?: string;
  onStateChanged?: (status: AIStatusMode, emotion?: AIEmotion) => void;
  onTranscriptionReceived?: (text: string, isFinal: boolean) => void;
  onAiResponseText?: (text: string, conversationSessionId?: string) => void;
}

export class LiveVoiceSyncManager {
  private micService: MicrophoneService;
  private playerService: AudioPlayerService;
  private config: LiveVoiceSyncConfig;
  private ws?: WebSocket;
  private isDuplexActive = false;
  private pendingAssistantText?: string;
  private receivedAssistantAudio = false;

  constructor(config: LiveVoiceSyncConfig = {}, player: AudioPlayerService = audioPlayerService) {
    this.config = config;
    this.playerService = player;
    this.micService = new MicrophoneService({ wsUrl: config.wsUrl });

    this.micService.setOnMessageCallback((frame: any) => {
      this.handleIncomingWsFrame(frame);
    });
  }

  public async startDuplexSession(conversationSessionId?: string): Promise<void> {
    if (this.isDuplexActive) return;

    this.isDuplexActive = true;
    if (this.config.onStateChanged) {
      this.config.onStateChanged('listening', 'curious');
    }

    try {
      await this.micService.startRecording(conversationSessionId);
    } catch (err) {
      console.error('❌ LiveVoiceSyncManager: Failed to start microphone duplex session', err);
      this.stopDuplexSession();
      throw err;
    }
  }

  /**
   * User Barge-In Interruption: Immediately stop AI speech audio playback,
   * clear queues, notify backend VoiceManager, and revert avatar state to listening.
   */
  public handleUserBargeIn(reason: string = 'User barge-in'): void {
    console.log('⚡ LiveVoiceSyncManager: Handling user barge-in interruption');

    // 1. Stop active audio playback immediately
    this.playerService.stop();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    // 2. Send WS interrupt frame
    this.micService.interrupt();

    // 3. Sync avatar state to listening
    if (this.config.onStateChanged) {
      this.config.onStateChanged('listening', 'curious');
    }
  }

  private handleIncomingWsFrame(frame: any): void {
    switch (frame.type) {
      case 'AI_AUDIO_CHUNK':
        if (frame.audioBase64) {
          this.receivedAssistantAudio = true;
          this.handleAiAudioChunk(frame.audioBase64, frame.sampleRate || 16000);
        }
        break;
      case 'AI_RESPONSE_TEXT':
        if (frame.text && this.config.onAiResponseText) {
          this.config.onAiResponseText(frame.text, frame.conversationSessionId);
        }
        this.pendingAssistantText = frame.text;
        this.receivedAssistantAudio = false;
        break;
      case 'AI_AUDIO_END':
        if (!this.receivedAssistantAudio && this.pendingAssistantText && 'speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(this.pendingAssistantText);
          utterance.onstart = () => this.config.onStateChanged?.('speaking', 'happy');
          utterance.onend = () => this.config.onStateChanged?.('listening', 'curious');
          utterance.onerror = () => this.config.onStateChanged?.('listening', 'curious');
          window.speechSynthesis.speak(utterance);
        }
        this.pendingAssistantText = undefined;
        break;
      case 'TRANSCRIPTION':
        if (frame.text && this.config.onTranscriptionReceived) {
          this.config.onTranscriptionReceived(frame.text, frame.isFinal ?? true);
        }
        break;
      case 'STATE_CHANGED':
      case 'VOICE_STATE_CHANGED':
        if ((frame.voiceState || frame.state) && this.config.onStateChanged) {
          const statusMap: Record<string, AIStatusMode> = {
            IDLE: 'idle',
            LISTENING: 'listening',
            TRANSCRIBING: 'listening',
            THINKING: 'thinking',
            SPEAKING: 'speaking',
            COMPLETED: 'idle',
          };
          const mappedStatus = statusMap[frame.voiceState || frame.state] || 'idle';
          this.config.onStateChanged(mappedStatus);
        }
        break;
    }
  }

  public async handleAiAudioChunk(audioBase64: string, sampleRate: number): Promise<void> {
    // Convert base64 to ArrayBuffer for Web Audio decoding
    const binaryStr = atob(audioBase64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Play chunk via AudioPlayerService with speaking state callbacks
    if (this.config.onStateChanged) {
      this.config.onStateChanged('speaking', 'happy');
    }

    await this.playerService.playChunk(bytes.buffer, {
      onEnded: () => {
        if (this.config.onStateChanged && !this.playerService.getIsPlaying()) {
          this.config.onStateChanged('idle', 'neutral');
        }
      },
    });
  }

  public stopDuplexSession(): void {
    this.isDuplexActive = false;
    this.micService.stopRecording();
    this.micService.disconnect();
    this.playerService.stop();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    if (this.config.onStateChanged) {
      this.config.onStateChanged('idle', 'neutral');
    }

    console.log('⏹️ LiveVoiceSyncManager: Stopped full duplex voice session');
  }

  public getIsDuplexActive(): boolean {
    return this.isDuplexActive;
  }
}
