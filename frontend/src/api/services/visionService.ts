/**
 * Vision & Camera API Service — Mission 6.5
 * Multimodal Visual Question Answering, Scene Understanding, and OCR
 */

import { httpClient } from '../client.js';
import { ENDPOINTS } from '../endpoints.js';
import { ApiResult } from '../types.js';

export interface VisionAnalyzePayload {
  imageBase64: string;
  prompt?: string;
  sessionId?: string | null;
}

export interface VisionAnalyzeResponse {
  text: string;
  emotion?: string;
  sessionId: string;
  timestamp: string;
}

export const visionService = {
  /**
   * Sends image frame and prompt for Gemini multimodal visual question answering and scene understanding
   */
  async analyzeFrame(payload: VisionAnalyzePayload): Promise<ApiResult<VisionAnalyzeResponse>> {
    return httpClient.post<VisionAnalyzeResponse>(ENDPOINTS.VISION.ANALYZE_FRAME, payload);
  },
};
