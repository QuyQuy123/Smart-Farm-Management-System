// src/utils/audioRecorder.js
// Cross-platform MediaRecorder + Noise-Adaptive Web Audio VAD (Android WebM, iOS Safari MP4/M4A, Desktop)

export const MIME_CANDIDATES = [
  { mimeType: 'audio/webm;codecs=opus', filename: 'voice.webm' },
  { mimeType: 'audio/webm', filename: 'voice.webm' },
  { mimeType: 'audio/mp4;codecs=mp4a.40.2', filename: 'voice.m4a' },
  { mimeType: 'audio/mp4', filename: 'voice.mp4' },
  { mimeType: 'audio/ogg;codecs=opus', filename: 'voice.ogg' }
];

export const AUDIO_CONSTRAINTS = {
  audio: {
    channelCount: 1,
    sampleRate: 16000,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
};

export const VAD_CONFIG = {
  sampleIntervalMs: 50,
  calibrationMs: 250,
  minSpeechThreshold: 0.018,
  noiseMultiplier: 2.2,
  minSpeechActivationMs: 150,
  silenceStopMs: 1500,
  minValidSpeechMs: 450,
  maxRecordingMs: 20000,
  maxFileSizeBytes: 5 * 1024 * 1024,
  audioBitsPerSecond: 32000
};

export const NO_SPEECH_HINT =
  'Không nghe rõ giọng nói (có thể do tiếng ồn nền). Hãy giữ mic gần hơn và thử lại.';

/**
 * Selects the highest-priority supported MediaRecorder audio MIME type and extension.
 * Ensures iOS Safari / Homescreen PWA (MP4/AAC) and Android/Desktop (WebM Opus) both work.
 */
export function selectSupportedAudioMime(MediaRecorderCtor = globalThis.MediaRecorder) {
  if (MediaRecorderCtor && typeof MediaRecorderCtor.isTypeSupported === 'function') {
    for (const candidate of MIME_CANDIDATES) {
      try {
        if (MediaRecorderCtor.isTypeSupported(candidate.mimeType)) {
          return { ...candidate };
        }
      } catch (_e) {
        // try next MIME candidate
      }
    }
  }
  return { mimeType: 'audio/webm', filename: 'voice.webm' };
}

/** Computes root-mean-square acoustic frame energy E_RMS from normalized [-1..1] time-domain samples. */
export function computeFrameRms(samples) {
  if (!samples || samples.length === 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = samples[i];
    sumSq += v * v;
  }
  return Math.sqrt(sumSq / samples.length);
}

/** Computes adaptive speech activation threshold T_speech = max(0.018, E_noise * 2.2). */
export function computeSpeechThreshold(noiseFloor) {
  const safeFloor = Number.isFinite(noiseFloor) && noiseFloor > 0 ? noiseFloor : 0;
  return Math.max(VAD_CONFIG.minSpeechThreshold, safeFloor * VAD_CONFIG.noiseMultiplier);
}

function readAnalyserRms(analyser, floatBuf, byteBuf) {
  if (typeof analyser.getFloatTimeDomainData === 'function') {
    analyser.getFloatTimeDomainData(floatBuf);
    return computeFrameRms(floatBuf);
  }
  if (typeof analyser.getByteTimeDomainData === 'function') {
    analyser.getByteTimeDomainData(byteBuf);
    for (let i = 0; i < byteBuf.length; i += 1) {
      floatBuf[i] = (byteBuf[i] - 128) / 128;
    }
    return computeFrameRms(floatBuf);
  }
  return 0;
}

/**
 * Starts an adaptive cross-platform audio recording session with Web Audio noise calibration
 * and hands-free auto-silence termination.
 */
export async function createAdaptiveVoiceRecorder({
  onLevel,
  onTick,
  onComplete,
  onRejected,
  onError,
  audioConstraints = AUDIO_CONSTRAINTS,
  vadConfig = {}
} = {}) {
  const cfg = { ...VAD_CONFIG, ...vadConfig };

  if (!navigator?.mediaDevices?.getUserMedia || typeof window.MediaRecorder !== 'function') {
    throw new Error('Trình duyệt không hỗ trợ ghi âm microphone.');
  }

  const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
  const { mimeType, filename } = selectSupportedAudioMime(window.MediaRecorder);

  let recorder;
  try {
    recorder = new window.MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      audioBitsPerSecond: cfg.audioBitsPerSecond
    });
  } catch (_optErr) {
    recorder = new window.MediaRecorder(stream);
  }

  const chunks = [];
  const startedAt = Date.now();
  let stopped = false;
  let cancelled = false;
  let stopReason = 'manual';
  let vadIntervalId = null;
  let timerIntervalId = null;
  let maxTimeoutId = null;
  let audioContext = null;

  // VAD tracking state
  let hasVad = false;
  const noiseSamples = [];
  let calibrated = false;
  let speechThreshold = cfg.minSpeechThreshold;
  let speechRunMs = 0;
  let speechActivated = false;
  let totalSpeechMs = 0;
  let silenceAfterSpeechMs = 0;
  let elapsedVadMs = 0;

  const releaseTracksAndAudio = () => {
    if (vadIntervalId) {
      clearInterval(vadIntervalId);
      vadIntervalId = null;
    }
    if (timerIntervalId) {
      clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
    if (maxTimeoutId) {
      clearTimeout(maxTimeoutId);
      maxTimeoutId = null;
    }
    try {
      if (stream && typeof stream.getTracks === 'function') {
        stream.getTracks().forEach(track => {
          try { track.stop(); } catch (_e) { /* ignore */ }
        });
      }
    } catch (_e) { /* ignore */ }
    if (audioContext && typeof audioContext.close === 'function') {
      try {
        const res = audioContext.close();
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      } catch (_e) { /* ignore */ }
      audioContext = null;
    }
  };

  const stop = (reason = 'manual') => {
    if (stopped) return;
    stopped = true;
    stopReason = reason;
    if (recorder && recorder.state === 'recording') {
      try {
        recorder.stop();
        return;
      } catch (_e) {
        // fallback cleanup if recorder threw
      }
    }
    releaseTracksAndAudio();
  };

  const cancel = () => {
    cancelled = true;
    stop('cancelled');
  };

  // Setup Web Audio AnalyserNode VAD when available
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (typeof AudioContextCtor === 'function') {
    try {
      audioContext = new AudioContextCtor();
      if (typeof audioContext.createMediaStreamSource === 'function' && typeof audioContext.createAnalyser === 'function') {
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);

        const floatBuf = new Float32Array(analyser.fftSize || 1024);
        const byteBuf = new Uint8Array(analyser.fftSize || 1024);
        hasVad = true;

        vadIntervalId = setInterval(() => {
          if (stopped || cancelled) return;
          const rms = readAnalyserRms(analyser, floatBuf, byteBuf);
          elapsedVadMs += cfg.sampleIntervalMs;

          if (typeof onLevel === 'function') {
            onLevel(rms, speechThreshold);
          }

          if (!calibrated) {
            noiseSamples.push(rms);
            if (elapsedVadMs >= cfg.calibrationMs) {
              const avgNoise = noiseSamples.reduce((acc, v) => acc + v, 0) / Math.max(1, noiseSamples.length);
              speechThreshold = computeSpeechThreshold(avgNoise);
              calibrated = true;
            }
            return;
          }

          if (rms >= speechThreshold) {
            speechRunMs += cfg.sampleIntervalMs;
            silenceAfterSpeechMs = 0;
            totalSpeechMs += cfg.sampleIntervalMs;
            if (speechRunMs >= cfg.minSpeechActivationMs) {
              speechActivated = true;
            }
          } else {
            speechRunMs = 0;
            if (speechActivated) {
              silenceAfterSpeechMs += cfg.sampleIntervalMs;
              if (silenceAfterSpeechMs >= cfg.silenceStopMs) {
                stop('silence');
              }
            }
          }
        }, cfg.sampleIntervalMs);
      }
    } catch (_vadErr) {
      try {
        if (audioContext && typeof audioContext.close === 'function' && audioContext.state !== 'closed') {
          audioContext.close().catch(() => {});
        }
      } catch (_closeErr) { /* ignore */ }
      audioContext = null;
      hasVad = false;
    }
  }

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  recorder.onerror = (event) => {
    releaseTracksAndAudio();
    if (!cancelled && typeof onError === 'function') {
      onError(event?.error || new Error('Lỗi ghi âm MediaRecorder'));
    }
  };

  recorder.onstop = () => {
    const durationMs = Math.max(0, Date.now() - startedAt);
    releaseTracksAndAudio();

    if (cancelled) return;

    // Local Noise / Empty Gate: drop silent/too-short recordings before touching network
    if (hasVad && (!speechActivated || totalSpeechMs < cfg.minValidSpeechMs)) {
      if (typeof onRejected === 'function') {
        onRejected('NO_SPEECH', NO_SPEECH_HINT);
      }
      return;
    }

    const effectiveMime = recorder.mimeType || mimeType || 'audio/webm';
    const audioBlob = new Blob(chunks, { type: effectiveMime });

    if (audioBlob.size > cfg.maxFileSizeBytes) {
      if (typeof onRejected === 'function') {
        onRejected('FILE_TOO_LARGE', 'Đoạn ghi âm vượt quá giới hạn dung lượng 5 MB.');
      }
      return;
    }

    if (typeof onComplete === 'function') {
      onComplete({
        blob: audioBlob,
        mimeType: effectiveMime,
        filename,
        durationMs,
        speechDurationMs: totalSpeechMs,
        stopReason
      });
    }
  };

  timerIntervalId = setInterval(() => {
    if (stopped || cancelled) return;
    if (typeof onTick === 'function') {
      const elapsedSec = Math.min(Math.floor((Date.now() - startedAt) / 1000), Math.floor(cfg.maxRecordingMs / 1000));
      onTick(elapsedSec, Math.floor(cfg.maxRecordingMs / 1000));
    }
  }, 250);

  maxTimeoutId = setTimeout(() => {
    stop('max_duration');
  }, cfg.maxRecordingMs);

  recorder.start(250);

  return {
    mimeType,
    filename,
    stop,
    cancel,
    getState: () => ({ stopped, cancelled, speechActivated, totalSpeechMs, speechThreshold })
  };
}
