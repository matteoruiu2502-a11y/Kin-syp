import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useRef, useState } from 'react';

import { DICTATION_CONTEXTUAL_STRINGS } from '../../core';

export interface DictationState {
  listening: boolean;
  /** Texte reconnu en cours (résultats partiels inclus). */
  transcript: string;
  /** Reconnaissance sur l'appareil (aucun envoi audio). */
  onDevice: boolean;
  error: string | null;
}

/**
 * Dictée vocale médicale via la reconnaissance vocale native (iOS Speech /
 * Android SpeechRecognizer), en français, sur l'appareil lorsque c'est
 * possible (secret médical). À l'arrêt, le texte complet est transmis à `onFinal`.
 */
export function useDictation(onFinal: (text: string) => void) {
  const [state, setState] = useState<DictationState>({
    listening: false,
    transcript: '',
    onDevice: true,
    error: null,
  });
  const finalParts = useRef<string[]>([]);
  const partial = useRef('');
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;
  // Les événements natifs sont globaux : seule l'instance qui a lancé la dictée les traite.
  const ownerRef = useRef(false);

  const fullText = () => [...finalParts.current, partial.current].filter(Boolean).join(' ').trim();

  useSpeechRecognitionEvent('result', (event) => {
    if (!ownerRef.current) return;
    const text = event.results[0]?.transcript ?? '';
    if (event.isFinal) {
      finalParts.current.push(text);
      partial.current = '';
    } else {
      partial.current = text;
    }
    setState((s) => ({ ...s, transcript: fullText() }));
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (!ownerRef.current) return;
    // "no-speech" / "aborted" ne sont pas des erreurs pour l'utilisateur.
    if (event.error === 'no-speech' || event.error === 'aborted') return;
    setState((s) => ({ ...s, error: event.message }));
  });

  useSpeechRecognitionEvent('end', () => {
    if (!ownerRef.current) return;
    ownerRef.current = false;
    const text = fullText();
    finalParts.current = [];
    partial.current = '';
    setState((s) => ({ ...s, listening: false, transcript: '' }));
    if (text) onFinalRef.current(text);
  });

  const start = useCallback(async () => {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setState((s) => ({ ...s, error: 'Autorisez le micro et la reconnaissance vocale dans les réglages.' }));
      return;
    }
    const onDevice = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
    finalParts.current = [];
    partial.current = '';
    ownerRef.current = true;
    setState({ listening: true, transcript: '', onDevice, error: null });
    ExpoSpeechRecognitionModule.start({
      lang: 'fr-FR',
      interimResults: true,
      continuous: true,
      addsPunctuation: true,
      requiresOnDeviceRecognition: onDevice,
      contextualStrings: DICTATION_CONTEXTUAL_STRINGS,
    });
  }, []);

  const stop = useCallback(() => ExpoSpeechRecognitionModule.stop(), []);

  const toggle = useCallback(() => (state.listening ? stop() : start()), [start, stop, state.listening]);

  return { state, start, stop, toggle };
}
