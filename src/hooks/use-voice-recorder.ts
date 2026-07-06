import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useState } from 'react';
import { Alert } from 'react-native';

export interface VoiceRecording {
  uri: string;
  durationMillis: number;
}

/** Thin wrapper around expo-audio for a simple tap-to-record / tap-to-stop
 * voice-message flow (used by both AI Advisor and Accountant Chat). */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 200);
  const [busy, setBusy] = useState(false);

  async function start() {
    if (state.isRecording || busy) return;
    setBusy(true);
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setBusy(false);
      Alert.alert('Microphone access needed', 'Enable microphone access in Settings to record a voice message.');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setBusy(false);
  }

  async function stop(): Promise<VoiceRecording | null> {
    if (!state.isRecording) return null;
    const durationMillis = state.durationMillis;
    await recorder.stop();
    if (!recorder.uri) return null;
    return { uri: recorder.uri, durationMillis };
  }

  return { isRecording: state.isRecording, durationMillis: state.durationMillis, start, stop };
}
