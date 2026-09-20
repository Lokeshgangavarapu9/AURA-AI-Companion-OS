/**
 * AURA AI Companion OS — Frontend AudioPlayerService (Browser Playback Engine)
 * Manages streaming Web Audio / HTML5 Audio playback, audio chunk queueing, stop, pause, resume,
 * and immediate user barge-in interruption.
 */

export interface AudioPlayOptions {
  volume?: number;
  rate?: number;
  onEnded?: () => void;
  onError?: (err: Error) => void;
}

export class AudioPlayerService {
  private audioContext?: AudioContext;
  private currentSource?: AudioBufferSourceNode;
  private audioQueue: ArrayBuffer[] = [];
  private isPlaying = false;
  private isPaused = false;
  private volume = 1.0;
  private speechRate = 1.0;

  constructor() {
    // AudioContext will be lazy initialized on first user gesture or playback
  }

  private initAudioContext(): AudioContext {
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  /**
   * Enqueue binary audio chunk and start playing if idle
   */
  public async playChunk(buffer: ArrayBuffer, options: AudioPlayOptions = {}): Promise<void> {
    if (options.volume !== undefined) this.volume = options.volume;
    if (options.rate !== undefined) this.speechRate = options.rate;

    this.audioQueue.push(buffer);

    if (!this.isPlaying && !this.isPaused) {
      await this.processQueue(options);
    }
  }

  private async processQueue(options: AudioPlayOptions = {}): Promise<void> {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      if (options.onEnded) options.onEnded();
      return;
    }

    this.isPlaying = true;
    const ctx = this.initAudioContext();
    const chunkBuffer = this.audioQueue.shift()!;

    try {
      // Decode audio buffer (e.g. PCM / MP3 / Opus chunk)
      const audioBuffer = await ctx.decodeAudioData(chunkBuffer.slice(0));

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = this.speechRate;

      const gainNode = ctx.createGain();
      gainNode.gain.value = this.volume;

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      this.currentSource = source;

      source.onended = () => {
        this.currentSource = undefined;
        if (!this.isPaused && this.isPlaying) {
          this.processQueue(options);
        }
      };

      source.start(0);
    } catch (err: any) {
      this.isPlaying = false;
      console.error('AudioPlayerService: received an undecodable audio payload', err);
      options.onError?.(err instanceof Error ? err : new Error('Unable to decode assistant audio'));
      if (options.onEnded) options.onEnded();
    }
  }

  /**
   * Stop current playback and clear queue (User barge-in / Interruption)
   */
  public stop(): void {
    this.audioQueue = [];
    this.isPlaying = false;
    this.isPaused = false;

    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {
        // Ignore if already stopped
      }
      this.currentSource = undefined;
    }
    console.log('🛑 AudioPlayerService: Audio playback stopped & queue cleared');
  }

  public pause(): void {
    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend();
      this.isPaused = true;
      console.log('⏸️ AudioPlayerService: Audio playback paused');
    }
  }

  public resume(): void {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
      this.isPaused = false;
      console.log('▶️ AudioPlayerService: Audio playback resumed');
    }
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  public setSpeechRate(rate: number): void {
    this.speechRate = Math.max(0.5, Math.min(2.0, rate));
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export const audioPlayerService = new AudioPlayerService();
