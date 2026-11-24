// src/__tests__/voiceRecorder.test.jsx
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  selectSupportedAudioMime,
  computeFrameRms,
  computeSpeechThreshold,
  createAdaptiveVoiceRecorder,
  NO_SPEECH_HINT
} from '../utils/audioRecorder';
import { AIChatbot } from '../components/AIChatbot/AIChatbot';
import * as aiAssistantService from '../services/aiAssistantService';

vi.mock('../services/aiAssistantService', () => ({
  sendAssistantMessage: vi.fn(),
  transcribeAudio: vi.fn(),
}));

describe('Adaptive Cross-Platform Voice Recorder, Web Audio VAD & Hybrid Confidence UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();

    window.speechSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
      getVoices: vi.fn().mockReturnValue([{ lang: 'vi-VN', name: 'Vietnamese' }])
    };
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
        this.lang = '';
        this.rate = 1;
        this.voice = null;
      }
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.AudioContext;
    delete window.webkitAudioContext;
  });

  it('testAdaptiveMimeSelection_FallsBackToMp4WhenWebmUnsupported', () => {
    const iosSafariRecorder = {
      isTypeSupported: (mime) => mime === 'audio/mp4;codecs=mp4a.40.2' || mime === 'audio/mp4'
    };
    expect(selectSupportedAudioMime(iosSafariRecorder)).toEqual({
      mimeType: 'audio/mp4;codecs=mp4a.40.2',
      filename: 'voice.m4a'
    });

    const iosLegacyRecorder = {
      isTypeSupported: (mime) => mime === 'audio/mp4'
    };
    expect(selectSupportedAudioMime(iosLegacyRecorder)).toEqual({
      mimeType: 'audio/mp4',
      filename: 'voice.mp4'
    });

    const androidChromeRecorder = {
      isTypeSupported: (mime) => mime === 'audio/webm;codecs=opus' || mime === 'audio/webm'
    };
    expect(selectSupportedAudioMime(androidChromeRecorder)).toEqual({
      mimeType: 'audio/webm;codecs=opus',
      filename: 'voice.webm'
    });

    // Math helpers sanity
    expect(computeFrameRms(new Float32Array([0.1, -0.1, 0.1, -0.1]))).toBeCloseTo(0.1, 4);
    expect(computeSpeechThreshold(0.003)).toBeCloseTo(0.018, 4);
    expect(computeSpeechThreshold(0.02)).toBeCloseTo(0.044, 4);
  });

  it('testVadLocalRejection_SkipsApiCallOnShortSilentRecording', async () => {
    vi.useFakeTimers();

    const stopTrackMock = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: stopTrackMock }]
        })
      }
    });

    window.MediaRecorder = class {
      constructor(stream, opts) {
        this.stream = stream;
        this.mimeType = opts?.mimeType || 'audio/webm';
        this.state = 'inactive';
        this.ondataavailable = null;
        this.onstop = null;
      }
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        if (this.ondataavailable) {
          this.ondataavailable({ data: new Blob([new Uint8Array([1, 2, 3])], { type: this.mimeType }) });
        }
        if (this.onstop) this.onstop();
      }
      static isTypeSupported(mime) {
        return mime === 'audio/webm;codecs=opus';
      }
    };

    const closeAudioCtx = vi.fn().mockResolvedValue(undefined);
    window.AudioContext = class {
      createMediaStreamSource() {
        return { connect: vi.fn() };
      }
      createAnalyser() {
        return {
          fftSize: 1024,
          getFloatTimeDomainData: (buf) => buf.fill(0.004) // Pure low barn fan noise, below 0.018 threshold
        };
      }
      close() {
        return closeAudioCtx();
      }
    };

    const onRejected = vi.fn();
    const onComplete = vi.fn();

    render(
      <MemoryRouter initialEntries={['/journal']}>
        <AIChatbot />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));
    fireEvent.click(screen.getByTestId('voice-mic-button'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350); // Calibration + short noise (< 450ms speech)
    });

    // Stop mic manually
    fireEvent.click(screen.getByTestId('voice-mic-button'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(aiAssistantService.transcribeAudio).not.toHaveBeenCalled();
    expect(screen.getByTestId('voice-notice-banner')).toHaveTextContent(NO_SPEECH_HINT);
    expect(stopTrackMock).toHaveBeenCalled();
    expect(closeAudioCtx).toHaveBeenCalled();

    // Direct utility check as well
    const handle = await createAdaptiveVoiceRecorder({ onRejected, onComplete });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    handle.stop('manual');
    expect(onRejected).toHaveBeenCalledWith('NO_SPEECH', NO_SPEECH_HINT);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('testVadAutoStopsAfterSilenceAndDispatchesValidSpeech', async () => {
    vi.useFakeTimers();

    const stopTrackMock = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: stopTrackMock }]
        })
      }
    });

    window.MediaRecorder = class {
      constructor(stream, opts) {
        this.stream = stream;
        this.mimeType = opts?.mimeType || 'audio/mp4';
        this.state = 'inactive';
        this.ondataavailable = null;
        this.onstop = null;
      }
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        if (this.ondataavailable) {
          this.ondataavailable({ data: new Blob([new Uint8Array(64)], { type: this.mimeType }) });
        }
        if (this.onstop) this.onstop();
      }
      static isTypeSupported(mime) {
        return mime === 'audio/mp4;codecs=mp4a.40.2';
      }
    };

    let sampleCall = 0;
    window.AudioContext = class {
      createMediaStreamSource() {
        return { connect: vi.fn() };
      }
      createAnalyser() {
        return {
          fftSize: 1024,
          getFloatTimeDomainData: (buf) => {
            sampleCall += 1;
            // Calls 1..5 (250ms calibration): noise=0.004
            // Calls 6..18 (650ms speech >= 450ms): loud speech=0.14
            // Calls 19+ (1500ms trailing silence): silence=0.002 -> auto-stop triggered
            const val = sampleCall <= 5 ? 0.004 : (sampleCall <= 18 ? 0.14 : 0.002);
            buf.fill(val);
          }
        };
      }
      close() {
        return Promise.resolve();
      }
    };

    const onComplete = vi.fn();
    const onRejected = vi.fn();
    await createAdaptiveVoiceRecorder({ onComplete, onRejected });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2600);
    });

    expect(onRejected).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
    const payload = onComplete.mock.calls[0][0];
    expect(payload.stopReason).toBe('silence');
    expect(payload.filename).toBe('voice.m4a');
    expect(payload.speechDurationMs).toBeGreaterThanOrEqual(450);
    expect(stopTrackMock).toHaveBeenCalled();
  });

  it('testHybridConfidenceRouting_HighAutoSubmitsLowPopulatesInput', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }]
        })
      }
    });

    window.MediaRecorder = class {
      constructor(stream, opts) {
        this.mimeType = opts?.mimeType || 'audio/webm';
        this.state = 'inactive';
        this.ondataavailable = null;
        this.onstop = null;
      }
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        if (this.ondataavailable) {
          this.ondataavailable({ data: new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2])], { type: this.mimeType }) });
        }
        if (this.onstop) this.onstop();
      }
      static isTypeSupported() {
        return true;
      }
    };

    // High confidence >= 0.82 auto-submits when handsFreeMode is ON
    aiAssistantService.transcribeAudio
      .mockResolvedValueOnce({
        text: 'cho Nhà A1 ăn 4.5 bao cám Higro 510',
        normalizedText: 'cho Nhà A1 ăn 4.5 bao cám Higro 510',
        confidence: 0.91,
        autoSubmitEligible: true,
        corrections: [{ from: 'hi gờ rô năm mốt không', to: 'Higro 510' }],
        rejectedReason: null,
        fallback: false
      })
      // Low/medium confidence < 0.82 populates input for review instead of submitting
      .mockResolvedValueOnce({
        text: 'cho Nhà B2 ăn 2 bao cám',
        normalizedText: 'cho Nhà B2 ăn 2 bao cám',
        confidence: 0.68,
        autoSubmitEligible: false,
        corrections: [{ from: 'nhà bê hai', to: 'Nhà B2' }],
        rejectedReason: null,
        fallback: false
      });

    aiAssistantService.sendAssistantMessage.mockResolvedValueOnce({
      reply: 'Bạn có muốn ghi nhận cho Nhà A1 ăn 4.5 bao (112.5 kg) cám Higro 510 không?',
      actionType: 'LOG_FEED',
      executed: false,
      requiresConfirmation: true,
      pendingAction: {
        actionType: 'LOG_FEED',
        actionId: 'id-1',
        actionToken: 'tok-1',
        title: 'Ghi nhật ký cám',
        payload: { actionType: 'LOG_FEED', barnId: 1 }
      }
    });

    render(
      <MemoryRouter initialEntries={['/journal']}>
        <AIChatbot />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('ai-chatbot-launcher'));

    // Recording #1 -> High confidence (>= 0.82) -> auto-dispatches sendAssistantMessage
    fireEvent.click(screen.getByTestId('voice-mic-button'));
    await waitFor(() => expect(screen.getByTestId('listening-banner')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('voice-mic-button'));

    await waitFor(() => {
      expect(aiAssistantService.sendAssistantMessage).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'cho Nhà A1 ăn 4.5 bao cám Higro 510' })
      );
    });

    // Recording #2 -> Low confidence (< 0.82) -> populates editable input & renders correction chip
    fireEvent.click(screen.getByTestId('voice-mic-button'));
    await waitFor(() => expect(screen.getByTestId('listening-banner')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('voice-mic-button'));

    await waitFor(() => {
      const chatInput = screen.getByPlaceholderText(/Hỏi hoặc ra lệnh/i);
      expect(chatInput.value).toBe('cho Nhà B2 ăn 2 bao cám');
      expect(screen.getByTestId('voice-corrections-banner')).toHaveTextContent('Nhà B2');
      expect(screen.getByTestId('voice-confidence-pill')).toHaveTextContent('Tin cậy 68%');
    });

    // Must NOT have auto-submitted second low-confidence recording
    expect(aiAssistantService.sendAssistantMessage).toHaveBeenCalledTimes(1);
  });
});
