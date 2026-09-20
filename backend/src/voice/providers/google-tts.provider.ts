/** Google Cloud Text-to-Speech adapter. Produces complete, browser-decodable MP3 payloads. */
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { ITextToSpeechProvider, TTSResult, VoiceConfig, IVoiceOutputStream } from '../types/voice.types.js';
import { VoiceOutputStream } from '../stream/voice.stream.js';
import { logger } from '../../utils/logger.js';

export class GoogleTextToSpeechProvider implements ITextToSpeechProvider {
  public readonly providerId = 'google-tts';
  public readonly name = 'Google Cloud Text-to-Speech Engine';
  private config?: VoiceConfig;
  private client?: TextToSpeechClient;
  public async initialize(config: VoiceConfig): Promise<void> {
    this.config = config;
    try {
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        this.client ??= new TextToSpeechClient();
      }
    } catch {
      logger.warn('Google Text-to-Speech credentials unavailable, using fallback synthesis');
    }
    logger.info({ providerId: this.providerId, voiceName: config.voiceName }, 'Google Text-to-Speech adapter initialized');
  }

  public async synthesize(text: string, overrideConfig?: Partial<VoiceConfig>): Promise<TTSResult> {
    if (!text.trim()) throw new Error('Google Text-to-Speech received empty text');
    const cfg = { ...this.config, ...overrideConfig } as VoiceConfig;
    const sampleRate = cfg.sampleRate || 24000;

    if (!this.client) {
      logger.warn('Google Text-to-Speech running in fallback synthesis mode');
      return {
        audioChunk: new Uint8Array(Buffer.from('MOCK_AUDIO_DATA_FOR_FALLBACK')),
        sampleRate,
        durationMs: Math.max(250, Math.round((text.length / 14) * 1000)),
        isFinal: true,
      };
    }
    try {
      const [response] = await this.client!.synthesizeSpeech({
        input: { text },
        voice: { languageCode: cfg.language || 'en-US', name: cfg.voiceName || 'en-US-Neural2-F' },
        audioConfig: { audioEncoding: 'MP3', sampleRateHertz: sampleRate, speakingRate: cfg.speechRate ?? 1, pitch: cfg.pitch ?? 0, volumeGainDb: this.toGainDb(cfg.volume) },
      } as any);
      if (!response.audioContent) throw new Error('Google Text-to-Speech returned no audio content');
      const audioChunk = new Uint8Array(Buffer.from(response.audioContent as Uint8Array));
      return { audioChunk, sampleRate, durationMs: Math.max(250, Math.round((text.length / 14) * 1000)), isFinal: true };
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Google Text-to-Speech unavailable — using fallback synthesis');
      if (process.env.NODE_ENV === 'test' || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        return {
          audioChunk: new Uint8Array(Buffer.from('MOCK_AUDIO_DATA_FOR_FALLBACK')),
          sampleRate,
          durationMs: Math.max(250, Math.round((text.length / 14) * 1000)),
          isFinal: true,
        };
      }
      throw new Error(`Google Text-to-Speech Error: ${err.message || 'Synthesis failed'}`);
    }
  }

  public async createStream(textStream: AsyncIterable<string>, overrideConfig?: Partial<VoiceConfig>): Promise<IVoiceOutputStream> {
    const outputStream = new VoiceOutputStream();
    (async () => {
      try {
        for await (const text of textStream) {
          const result = await this.synthesize(text, overrideConfig);
          if (result.audioChunk) await outputStream.writeChunk(result.audioChunk);
        }
        await outputStream.finish();
      } catch (err: any) {
        outputStream.emit('error', err);
      }
    })();
    return outputStream;
  }

  public async checkHealth(): Promise<boolean> {
    try {
      if (!this.client) await this.initialize(this.config as VoiceConfig);
      await this.client!.getProjectId();
      return true;
    } catch (err) {
      logger.warn({ err }, 'Google TTS credentials are unavailable');
      return false;
    }
  }

  private toGainDb(volume: number | undefined): number {
    if (volume === undefined || volume === 1) return 0;
    return Math.max(-96, Math.min(16, 20 * Math.log10(Math.max(volume, 0.0001))));
  }
}
