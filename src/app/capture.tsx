import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CaptureControls } from '@/components/capture/capture-controls';
import { ScanningReticle } from '@/components/capture/scanning-reticle';
import { Button, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { createManualReceipt, uploadReceipt, type CapturedFile } from '@/services/receipts';
import { cameraChrome } from '@/theme';

type CaptureMode = 'single' | 'batch';
type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export default function CaptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { firmId, clientId, user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [mode, setMode] = useState<CaptureMode>('single');
  const [queue, setQueue] = useState<CapturedFile[]>([]);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const canUpload = Boolean(firmId && clientId && user);

  async function runUpload(files: CapturedFile[]) {
    if (!canUpload) {
      setStatus('error');
      setErrorMsg('Your account is not linked to a company yet. Ask your accountant to check your invite.');
      return;
    }
    setStatus('uploading');
    setErrorMsg(null);
    let lastReceiptId: string | undefined;
    for (let i = 0; i < files.length; i++) {
      setProgress({ done: i, total: files.length });
      const res = await uploadReceipt(files[i], firmId as string, clientId as string, (user as { id: string }).id);
      if (!res.ok) {
        setStatus('error');
        setErrorMsg(res.error ?? 'Upload failed.');
        return;
      }
      lastReceiptId = res.receiptId;
    }
    setProgress({ done: files.length, total: files.length });

    // Single capture → straight into the review/categorise wizard (OCR runs
    // there). Batch uploads skip it: categorising a whole queue one-by-one
    // here would be worse than letting the accountant triage them.
    if (files.length === 1 && lastReceiptId) {
      setStatus('idle');
      setProgress(null);
      router.replace({ pathname: '/receipt-wizard', params: { id: lastReceiptId } });
      return;
    }
    setStatus('success');
  }

  async function handleShutter() {
    if (!cameraReady || !cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) return;
      const file: CapturedFile = { uri: photo.uri, mimeType: 'image/jpeg' };
      if (mode === 'batch') {
        setQueue((q) => [...q, file]);
      } else {
        await runUpload([file]);
      }
    } catch {
      setStatus('error');
      setErrorMsg('Could not capture the photo. Try again.');
    }
  }

  async function handleGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photo access needed', 'Enable photo library access in Settings to upload a receipt.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await runUpload([{ uri: asset.uri, mimeType: asset.mimeType ?? '' }]);
  }

  async function handleManualEntry() {
    if (!canUpload) {
      Alert.alert('Not linked yet', 'Your account is not linked to a company yet. Ask your accountant to check your invite.');
      return;
    }
    const res = await createManualReceipt(firmId as string, clientId as string, (user as { id: string }).id);
    if (!res.ok || !res.receiptId) {
      Alert.alert('Could not start', res.error ?? 'Please try again.');
      return;
    }
    // Reuse the review wizard, but skip OCR (there's no photo to read).
    router.replace({ pathname: '/receipt-wizard', params: { id: res.receiptId, manual: '1' } });
  }

  function finishBatch() {
    if (queue.length === 0) return;
    const files = queue;
    setQueue([]);
    void runUpload(files);
  }

  function reset() {
    setStatus('idle');
    setErrorMsg(null);
    setProgress(null);
  }

  function close() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  if (!permission) {
    return <View style={styles.root} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Ionicons name="camera-outline" size={48} color={cameraChrome.foregroundSubtle} />
        <Text variant="title" style={{ color: cameraChrome.foreground, marginTop: 16, textAlign: 'center' }}>
          Camera access needed
        </Text>
        <Text variant="body" style={{ color: cameraChrome.foregroundMuted, textAlign: 'center', marginTop: 8, marginBottom: 24 }}>
          Mizan uses your camera to photograph receipts for your accountant to review.
        </Text>
        <Button title="Enable camera" onPress={() => requestPermission()} />
        <Pressable onPress={close} style={{ marginTop: 16 }}>
          <Text variant="footnote" style={{ color: cameraChrome.foregroundSubtle }}>
            Cancel
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        onCameraReady={() => setCameraReady(true)}
      />

      {/* Dark gradient scrim (approximated with a flat overlay — no linear-gradient dep). */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim]} />

      <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={styles.roundButton}>
            <Ionicons name="close" size={20} color={cameraChrome.foreground} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle flash"
            onPress={() => setTorch((t) => !t)}
            style={styles.roundButton}>
            <Ionicons name={torch ? 'flash' : 'flash-outline'} size={20} color={cameraChrome.foreground} />
          </Pressable>
        </View>

        <View style={styles.instructionWrap}>
          <View style={styles.instructionPill}>
            <Text style={styles.instructionText}>Position receipt within the frame</Text>
          </View>
        </View>

        <View style={styles.reticleWrap}>
          <ScanningReticle />
        </View>

        {queue.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={finishBatch} style={styles.queueBadge}>
            <Text style={styles.queueBadgeText}>Done ({queue.length})</Text>
          </Pressable>
        ) : null}

        <CaptureControls
          mode={mode}
          onModeChange={setMode}
          onGallery={handleGallery}
          onShutter={handleShutter}
          onManualEntry={handleManualEntry}
          onUploadFromLibrary={handleGallery}
          shutterDisabled={!cameraReady}
        />
      </View>

      {status !== 'idle' ? (
        <View style={[StyleSheet.absoluteFill, styles.statusOverlay]}>
          {status === 'uploading' ? (
            <>
              <Text style={styles.statusTitle}>Uploading receipt…</Text>
              {progress ? (
                <Text style={styles.statusBody}>
                  {progress.done} of {progress.total}
                </Text>
              ) : null}
            </>
          ) : status === 'success' ? (
            <>
              <Ionicons name="checkmark-circle" size={56} color={cameraChrome.success} />
              <Text style={styles.statusTitle}>Receipt uploaded</Text>
              <Text style={styles.statusBody}>Pending review by your accountant.</Text>
              <Button title="Done" onPress={close} />
            </>
          ) : (
            <>
              <Ionicons name="alert-circle" size={56} color={cameraChrome.danger} />
              <Text style={styles.statusTitle}>Upload failed</Text>
              <Text style={styles.statusBody}>{errorMsg}</Text>
              <Button title="Try again" onPress={reset} />
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: cameraChrome.surface,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  scrim: {
    backgroundColor: cameraChrome.scrim,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 64,
    paddingHorizontal: 20,
  },
  roundButton: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    backgroundColor: cameraChrome.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionWrap: {
    alignItems: 'center',
    paddingTop: 8,
  },
  instructionPill: {
    backgroundColor: cameraChrome.glass,
    borderWidth: 1,
    borderColor: cameraChrome.glassBorder,
    borderRadius: 9999,
    paddingHorizontal: 25,
    paddingVertical: 9,
  },
  instructionText: {
    color: cameraChrome.foreground,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  reticleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  queueBadge: {
    alignSelf: 'center',
    marginBottom: 12,
    backgroundColor: cameraChrome.pillSolid,
    borderRadius: 9999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  queueBadgeText: {
    color: cameraChrome.foreground,
    fontWeight: '700',
  },
  statusOverlay: {
    backgroundColor: cameraChrome.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  statusTitle: {
    color: cameraChrome.foreground,
    fontSize: 18,
    fontWeight: '700',
  },
  statusBody: {
    color: cameraChrome.foregroundMuted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
});
