/**
 * AURA Voice Bridge — Audio Chunk Protocol & WebSocket Frame Contracts
 * Mission 5.8a.5 Protocol Specification
 */

export enum AudioFrameType {
  START_SESSION = 'START_SESSION',
  AUDIO_CHUNK = 'AUDIO_CHUNK',
  TRANSCRIPTION = 'TRANSCRIPTION',
  END_SPEECH = 'END_SPEECH',
  INTERRUPT = 'INTERRUPT',
  PAUSE_SESSION = 'PAUSE_SESSION',
  RESUME_SESSION = 'RESUME_SESSION',
  STOP_SESSION = 'STOP_SESSION',
  
  // Server -> Client responses
  SESSION_STARTED = 'SESSION_STARTED',
  STATE_CHANGED = 'STATE_CHANGED',
  TRANSCRIPTION_PARTIAL = 'TRANSCRIPTION_PARTIAL',
  TRANSCRIPTION_FINAL = 'TRANSCRIPTION_FINAL',
  AI_AUDIO_CHUNK = 'AI_AUDIO_CHUNK',
  AI_AUDIO_END = 'AI_AUDIO_END',
  ERROR = 'ERROR',
}

export interface BaseAudioMessage {
  type: AudioFrameType;
  sessionId?: string;
  conversationSessionId?: string;
  timestamp?: number;
}

export interface StartSessionMessage extends BaseAudioMessage {
  type: AudioFrameType.START_SESSION;
  sampleRate?: number;
  channels?: number;
  language?: string;
}

export interface AudioChunkMessage extends BaseAudioMessage {
  type: AudioFrameType.AUDIO_CHUNK;
  audioBase64: string; // Base64 encoded audio PCM/Opus chunk
  sampleRate?: number;
  sequenceNumber?: number;
}

/** A final transcript produced by a browser-native recognizer. */
export interface TranscriptionMessage extends BaseAudioMessage {
  type: AudioFrameType.TRANSCRIPTION;
  text: string;
  isFinal?: boolean;
}

export interface InterruptMessage extends BaseAudioMessage {
  type: AudioFrameType.INTERRUPT;
  reason?: string;
}

export interface ServerStateChangedMessage extends BaseAudioMessage {
  type: AudioFrameType.STATE_CHANGED;
  voiceState: string;
}

export interface ServerAiAudioChunkMessage extends BaseAudioMessage {
  type: AudioFrameType.AI_AUDIO_CHUNK;
  audioBase64: string;
  sampleRate: number;
}

export interface ServerErrorMessage extends BaseAudioMessage {
  type: AudioFrameType.ERROR;
  error: string;
}

export type ClientAudioMessage =
  | StartSessionMessage
  | AudioChunkMessage
  | TranscriptionMessage
  | InterruptMessage
  | BaseAudioMessage;
