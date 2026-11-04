import { Platform } from 'react-native';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { impactAsync, notificationAsync, ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';

/**
 * The feed's sound effects, short tonal chimes in one key (assets/sfx, made by a script, no voices):
 * a rising two-note for Got it, a low thud for Forgot, a run of notes for milestones and the finish,
 * a short lift when the streak ticks up. They follow the feed's mute toggle.
 */
export type Sfx = 'knew' | 'forgot' | 'milestone' | 'finish' | 'streak';
const SOURCES: Record<Sfx, number> = {
  knew: require('../../assets/sfx/knew.wav'),
  forgot: require('../../assets/sfx/forgot.wav'),
  milestone: require('../../assets/sfx/milestone.wav'),
  finish: require('../../assets/sfx/finish.wav'),
  streak: require('../../assets/sfx/streak.wav'),
};
const players: Partial<Record<Sfx, AudioPlayer>> = {};

export function playSfx(name: Sfx, muted: boolean): void {
  if (muted || Platform.OS === 'web') return;
  try {
    const player = players[name] ??= createAudioPlayer(SOURCES[name]);
    void player.seekTo(0).then(() => player.play()).catch(() => undefined);
  } catch { /* sound is a bonus, never an error */ }
}

/** A tap for a pass, a double thud for a miss, a flourish on a milestone. iOS only; the web has no haptics. */
export function hapticFor(kind: 'knew' | 'forgot' | 'milestone' | 'streak'): void {
  if (Platform.OS === 'web') return;
  const run = kind === 'forgot' ? notificationAsync(NotificationFeedbackType.Error)
    : kind === 'knew' ? impactAsync(ImpactFeedbackStyle.Light)
    : notificationAsync(NotificationFeedbackType.Success);
  void run.catch(() => undefined);
}
