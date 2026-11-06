// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const creation = vi.hoisted(() => ({ chooseMaterial: vi.fn(), pendingMaterial: vi.fn(), resumeMaterial: vi.fn(), savePastedWords: vi.fn(), saveWords: vi.fn(), stageMaterial: vi.fn(), textMaterial: vi.fn() }));
vi.mock('../lib/creation', () => creation);
const drive = vi.hoisted(() => ({ addFromDrive: vi.fn(), driveSources: vi.fn() }));
vi.mock('../lib/drive', () => drive);
const canva = vi.hoisted(() => ({ canvaDesigns: vi.fn(), connectCanva: vi.fn(), importCanvaDesign: vi.fn() }));
vi.mock('../lib/canva', () => canva);
vi.mock('../lib/useLibrary', () => ({ message: (e: Error) => e.message }));
vi.mock('expo-haptics', () => ({ impactAsync: vi.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
vi.mock('expo-web-browser', () => ({ openBrowserAsync: vi.fn() }));
vi.mock('@expo/vector-icons/Feather', () => ({ default: () => null }));
vi.mock('react-native', () => {
  const Box = ({ children }: { children: ReactNode }) => createElement('div', null, children);
  return { View: Box, Text: Box, Image: Box, Modal: Box, KeyboardAvoidingView: Box, ScrollView: Box, Platform: { OS: 'web' }, useWindowDimensions: () => ({ height: 844 }), Linking: { openURL: vi.fn() }, StyleSheet: { create: (s: unknown) => s, hairlineWidth: 1 },
    Pressable: ({ children, accessibilityLabel, onPress, disabled }: { children: ReactNode; accessibilityLabel: string; onPress: () => void; disabled?: boolean }) => createElement('button', { 'aria-label': accessibilityLabel, onClick: onPress, disabled }, children),
    TextInput: ({ accessibilityLabel, value, onChangeText }: { accessibilityLabel: string; value: string; onChangeText: (v: string) => void }) => createElement('textarea', { 'aria-label': accessibilityLabel, value, onChange: (e: { target: { value: string } }) => onChangeText(e.target.value) }),
  };
});
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 34 }), SafeAreaView: ({ children }: { children: ReactNode }) => createElement('div', null, children) }));
vi.mock('../components/UI', () => ({ s: {}, T: ({ children }: { children: ReactNode }) => createElement('span', null, children),
  ErrorNotice: ({ children }: { children: ReactNode }) => children ? createElement('span', { role: 'alert' }, children) : null,
  Button: ({ children, onPress, busy, disabled }: { children: ReactNode; onPress: () => void; busy?: boolean; disabled?: boolean }) => createElement('button', { onClick: onPress, disabled: busy || disabled }, children),
}));
vi.mock('./CreationInbox', () => ({ CreationInbox: () => createElement('div', null, 'Native inbox') }));
vi.mock('./Credits', () => ({ Credits: () => null }));
vi.mock('./ImportSheet', () => ({ ImportSheet: () => createElement('div', null, 'Anki chooser') }));
import { CreateSheet } from './CreateSheet';
const props = () => ({ userId: 'owner' as string | null, authenticating: false, authError: null, onSignIn: vi.fn(), onClose: vi.fn(), onReview: vi.fn().mockResolvedValue(undefined) });
beforeEach(() => { vi.resetAllMocks(); creation.pendingMaterial.mockResolvedValue(null); drive.driveSources.mockResolvedValue([]); });
afterEach(cleanup);

it('lets a new user choose a language before sign-in and keeps it afterward', async () => {
  const p = { ...props(), userId: null as string | null };
  const view = render(createElement(CreateSheet, p));
  fireEvent.click(screen.getByRole('button', { name: 'Try a starter set' }));
  fireEvent.click(screen.getByRole('button', { name: 'Japanese' }));
  expect(creation.chooseMaterial).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
  expect(p.onSignIn).toHaveBeenCalledOnce();
  expect(creation.saveWords).not.toHaveBeenCalled();
  view.rerender(createElement(CreateSheet, { ...p, userId: 'owner' }));
  creation.saveWords.mockResolvedValue({ created: 10, duplicates: 0, sourceId: 'starter' });
  fireEvent.click(screen.getByRole('button', { name: 'Add 10 words' }));
  await screen.findByText('10 words ready.');
  expect(creation.saveWords).toHaveBeenCalledWith('owner', 'ja', 'Japanese · First words', 'starter:first-words:v1:ja', expect.arrayContaining([expect.objectContaining({ front: 'こんにちは' })]));
  fireEvent.click(screen.getByRole('button', { name: 'Start review' }));
  await waitFor(() => expect(p.onReview).toHaveBeenCalledWith('starter'));
});
it('opens Photos only on a visible tap and stays usable after cancellation', async () => {
  creation.chooseMaterial.mockResolvedValue(null);
  render(createElement(CreateSheet, props()));
  fireEvent.click(screen.getByRole('button', { name: 'Photos & screenshots' }));
  await act(async () => {});
  expect(creation.chooseMaterial).not.toHaveBeenCalled();
  const choose = screen.getByRole('button', { name: 'Choose photos or screenshots' });
  fireEvent.click(choose);
  await waitFor(() => expect(creation.chooseMaterial).toHaveBeenCalledWith(true));
  await waitFor(() => expect(choose.hasAttribute('disabled')).toBe(false));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('button', { name: 'Find my words' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Back to ways to add words' }));
  expect(screen.getByRole('button', { name: 'Try a starter set' })).toBeTruthy();
});
it('saves explicit pairs directly and sends mixed notes through the review inbox', async () => {
  const p = props();
  render(createElement(CreateSheet, p));
  fireEvent.click(screen.getByRole('button', { name: 'Paste words or notes' }));
  fireEvent.change(screen.getByLabelText('Words or notes'), { target: { value: 'hola — hello' } });
  creation.savePastedWords.mockResolvedValue({ created: 1, duplicates: 0, sourceId: 'words' });
  fireEvent.click(screen.getByRole('button', { name: 'Add 1 word' }));
  await screen.findByText('1 word ready.');
  expect(creation.stageMaterial).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Back to ways to add words' }));
  fireEvent.click(screen.getByRole('button', { name: 'Paste words or notes' }));
  fireEvent.change(screen.getByLabelText('Words or notes'), { target: { value: 'hola — hello\nToday we talked about food' } });
  creation.textMaterial.mockReturnValue({ name: 'notes', bytes: new Uint8Array([1]), contentType: 'text/plain' });
  creation.stageMaterial.mockResolvedValue({ source: { id: 'notes' }, uri: 'file://saved', contentType: 'text/plain' });
  creation.resumeMaterial.mockRejectedValue(new Error('network stopped'));
  fireEvent.click(screen.getByRole('button', { name: 'Find my words' }));
  await screen.findByText('Native inbox');
  await screen.findByRole('alert');
  expect(creation.resumeMaterial).toHaveBeenCalledWith('owner', expect.objectContaining({ uri: 'file://saved' }));
});

it('picks from Google Drive in the app and tracks the chosen file', async () => {
  drive.driveSources.mockResolvedValue([{ id: 'old', type: 'google_doc', label: 'Clase 3', status: 'active', externalRef: 'x', language: 'es', userId: 'owner' }]);
  drive.addFromDrive.mockResolvedValue({ id: 'new' });
  render(createElement(CreateSheet, props()));
  fireEvent.click(screen.getByRole('button', { name: 'Google Docs & Sheets' }));
  await screen.findByText('Clase 3');
  fireEvent.click(screen.getByRole('button', { name: 'French' }));
  fireEvent.click(screen.getByRole('button', { name: 'Choose from Google Drive' }));
  await screen.findByText('Native inbox');
  expect(drive.addFromDrive).toHaveBeenCalledWith('owner', 'fr');
});

it('connects Canva and imports a chosen design natively', async () => {
  canva.canvaDesigns.mockResolvedValueOnce({ connected: false, designs: [], continuation: null })
    .mockResolvedValueOnce({ connected: true, designs: [{ id: 'D1', title: 'Week 2 vocab', thumbnail: null, updatedAt: null }], continuation: null });
  canva.connectCanva.mockResolvedValue(true);
  canva.importCanvaDesign.mockResolvedValue('src-1');
  render(createElement(CreateSheet, props()));
  fireEvent.click(screen.getByRole('button', { name: 'Canva notes' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Connect Canva' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Week 2 vocab' }));
  fireEvent.click(screen.getByRole('button', { name: 'Find my words' }));
  await screen.findByText('Native inbox');
  expect(canva.importCanvaDesign).toHaveBeenCalledWith('owner', expect.objectContaining({ id: 'D1' }), 'es', 'Week 2 vocab');
  expect(creation.stageMaterial).not.toHaveBeenCalled();
}, 15_000);
