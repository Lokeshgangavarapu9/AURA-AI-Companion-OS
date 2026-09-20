/**
 * AURA Voice Foundation — Master VoiceManager Orchestrator
 * Coordinates STT/TTS Providers, Voice Sessions, State Transitions, Streaming,
 * emotion hooks, capability checks, and seamless Runtime integration.
 *
 * Pipeline Flow:
 * Microphone -> SpeechToText -> ConversationManager -> Cognitive Engine -> Core Runtime -> Provider -> TextToSpeech -> Speaker
 */

import { EventEmitter } from 'events';
import {
  VoiceConfig,
  DEFAULT_VOICE_CONFIG,
  ISpeechToTextProvider,
  ITextToSpeechProvider,
  STTResult,
  TTSResult,
  VoiceState,
  VoiceSessionInfo,
  IVoiceEmotionFeatureExtractor,
  IVoiceCapabilityChecker,
} from './types/voice.types.js';
import { VoiceSessionManager, voiceSessionManager } from './session/voice.session-manager.js';
import { MockSpeechToTextProvider, MockTextToSpeechProvider } from './providers/voice.providers.js';
import {
  SpeechProviderManager,
  speechProviderManager,
} from './providers/speech-provider.manager.js';
import { ConversationManager, conversationManager } from '../conversation/manager/conversation.manager.js';
import { logger } from '../utils/logger.js';

export interface ProcessVoiceTurnInput {
  audioChunk?: Uint8Array;
  transcriptionText?: string;
  voiceSessionId?: string;
  conversationSessionId?: string;
  userId?: string;
}

export interface VoiceTurnResult {
  sessionId: string;
  conversationSessionId: string;
  userTranscription: string;
  aiResponseText: string;
  aiAudio?: TTSResult;
  sttResult: STTResult;
  executionTimeMs: number;
}

export class VoiceManager extends EventEmitter {
  private config: VoiceConfig;
  private sttProvider: ISpeechToTextProvider;
  private ttsProvider: ITextToSpeechProvider;
  private sessionManager: VoiceSessionManager;
  private convManager: ConversationManager;
  private providerMgr: SpeechProviderManager;

  // Extension points / Hooks
  private emotionExtractor?: IVoiceEmotionFeatureExtractor;
  private capabilityChecker?: IVoiceCapabilityChecker;

  constructor(
    config: Partial<VoiceConfig> = {},
    stt?: ISpeechToTextProvider,
    tts?: ITextToSpeechProvider,
    providerMgr: SpeechProviderManager = speechProviderManager,
    sessMgr: VoiceSessionManager = voiceSessionManager,
    cMgr: ConversationManager = conversationManager
  ) {
    super();
    this.config = { ...DEFAULT_VOICE_CONFIG, ...config };
    this.providerMgr = providerMgr;
    this.sttProvider = stt || this.providerMgr.getSTTProvider(this.config.sttProvider);
    this.ttsProvider = tts || this.providerMgr.getTTSProvider(this.config.ttsProvider);
    this.sessionManager = sessMgr;
    this.convManager = cMgr;
  }

  public async initialize(): Promise<void> {
    await this.sttProvider.initialize(this.config);
    await this.ttsProvider.initialize(this.config);
    logger.info({ config: this.config }, '🎙️ VoiceManager initialized successfully');
  }

  public updateConfig(newConfig: Partial<VoiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info({ config: this.config }, '🎙️ VoiceManager configuration updated');
  }

  public getConfig(): VoiceConfig {
    return { ...this.config };
  }

  /** Plug external SpeechToText provider */
  public setSTTProvider(provider: ISpeechToTextProvider): void {
    this.sttProvider = provider;
    this.config.sttProvider = provider.providerId;
    logger.info({ providerId: provider.providerId }, '🎙️ VoiceManager STT Provider switched');
  }

  /** Plug external TextToSpeech provider */
  public setTTSProvider(provider: ITextToSpeechProvider): void {
    this.ttsProvider = provider;
    this.config.ttsProvider = provider.providerId;
    logger.info({ providerId: provider.providerId }, '🗣️ VoiceManager TTS Provider switched');
  }

  /** Hook registration for emotion extension */
  public registerEmotionExtractor(extractor: IVoiceEmotionFeatureExtractor): void {
    this.emotionExtractor = extractor;
  }

  /** Hook registration for capability extension */
  public registerCapabilityChecker(checker: IVoiceCapabilityChecker): void {
    this.capabilityChecker = checker;
  }

  /**
   * Main Multimodal Execution Pipeline: Voice turn processing
   */
  public async processVoiceTurn(input: ProcessVoiceTurnInput): Promise<VoiceTurnResult> {
    const startTime = Date.now();

    // 1. Permission check hook verification
    if (this.capabilityChecker) {
      const hasMic = await this.capabilityChecker.hasMicrophonePermission();
      if (!hasMic) {
        throw new Error('Capability Security Error: Microphone access permission denied');
      }
    }

    // 2. Obtain / Create Voice Session & State Machine
    let session = input.voiceSessionId
      ? this.sessionManager.getSession(input.voiceSessionId)
      : undefined;

    if (!session) {
      session = this.sessionManager.startSession({
        conversationSessionId: input.conversationSessionId,
      });
    }

    const stateMachine = this.sessionManager.getStateMachine(session.sessionId)!;

    try {
      // 3. State Transition: IDLE -> LISTENING
      stateMachine.transitionTo(VoiceState.LISTENING, 'Receiving voice audio input');

      let sttResult: STTResult;

      if (input.audioChunk && input.audioChunk.length > 0) {
        // Emotion hook extraction if audio present
        if (this.emotionExtractor) {
          const emotionFeatures = this.emotionExtractor.extractFeatures(input.audioChunk);
          logger.info({ emotionFeatures }, '🎭 Emotion Hook: Extracted acoustic features from audio chunk');
        }

        // 4. State Transition: LISTENING -> TRANSCRIBING
        stateMachine.transitionTo(VoiceState.TRANSCRIBING, 'Audio transcription started');

        sttResult = await this.sttProvider.transcribe(input.audioChunk, this.config);
      } else if (input.transcriptionText) {
        stateMachine.transitionTo(VoiceState.TRANSCRIBING, 'Direct transcription text received');
        sttResult = {
          text: input.transcriptionText,
          isFinal: true,
          confidence: 1.0,
        };
      } else {
        throw new Error('Invalid Input: Either audioChunk or transcriptionText must be provided');
      }

      // 5. State Transition: TRANSCRIBING -> THINKING
      stateMachine.transitionTo(VoiceState.THINKING, 'Sending normalized text to ConversationManager');

      // 6. Seamless Integration into ConversationManager -> Cognitive Engine -> Runtime Orchestrator
      const convResult = await this.convManager.processConversation({
        userMessage: sttResult.text,
        sessionId: session.conversationSessionId || input.conversationSessionId,
        userId: input.userId,
      });

      // Update voice session conversation reference
      session.conversationSessionId = convResult.sessionId;

      // 7. State Transition: THINKING -> SPEAKING
      stateMachine.transitionTo(VoiceState.SPEAKING, 'Synthesizing response text to speech');

      // 8. TextToSpeech Synthesis
      let ttsResult: TTSResult | undefined;
      try {
        ttsResult = await this.ttsProvider.synthesize(convResult.aiResponse.text, this.config);
      } catch (err) {
        logger.error({ err, voiceSessionId: session.sessionId }, 'Voice synthesis failed; continuing with text-only response');
      }

      // Update session metrics
      session.metrics.turnsCount += 1;
      if (sttResult.durationMs) session.metrics.inputAudioDurationMs += sttResult.durationMs;
      if (ttsResult) session.metrics.outputAudioDurationMs += ttsResult.durationMs;

      // 9. State Transition: SPEAKING -> COMPLETED
      stateMachine.transitionTo(VoiceState.COMPLETED, 'Voice turn execution completed successfully');

      // Reset to IDLE for next turn
      stateMachine.transitionTo(VoiceState.IDLE, 'Turn complete, ready for next speech');

      const executionTimeMs = Date.now() - startTime;

      logger.info(
        {
          voiceSessionId: session.sessionId,
          convSessionId: convResult.sessionId,
          userText: sttResult.text,
          aiText: convResult.aiResponse.text,
          executionTimeMs,
        },
        '🎉 VoiceManager: Successfully completed full voice conversation turn'
      );

      return {
        sessionId: session.sessionId,
        conversationSessionId: convResult.sessionId,
        userTranscription: sttResult.text,
        aiResponseText: convResult.aiResponse.text,
        aiAudio: ttsResult,
        sttResult,
        executionTimeMs,
      };
    } catch (err: any) {
      logger.error({ err, sessionId: session.sessionId }, '❌ VoiceManager: Error during voice turn');
      stateMachine.transitionTo(VoiceState.ERROR, err.message || 'Unknown voice error');
      stateMachine.reset();
      throw err;
    }
  }

  /** Intercept and interrupt active speaking output */
  public handleInterruption(voiceSessionId: string, reason: string = 'User barge-in'): void {
    const sm = this.sessionManager.getStateMachine(voiceSessionId);
    if (sm) {
      sm.interrupt(reason);
    }
  }
}

export const voiceManager = new VoiceManager();
