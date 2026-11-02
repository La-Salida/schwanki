// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const imports = vi.hoisted(() => ({ resumeImport: vi.fn(), chooseImport: vi.fn(), runImport: vi.fn() }));
vi.mock('../lib/importer', () => imports);
vi.mock('../lib/useLibrary', () => ({ message: (error: Error) => error.message }));
vi.mock('react-native', () => ({
  View: ({ children }: { children: ReactNode }) => createElement('div', null, children),
  Pressable: ({ children }: { children: ReactNode }) => createElement('div', null, children),
  ActivityIndicator: () => createElement('span', { role: 'progressbar' }),
}));
vi.mock('../components/UI', () => ({
  s: {},
  T: ({ children }: { children: ReactNode }) => createElement('span', null, children),
  ErrorNotice: ({ children }: { children: ReactNode }) => children ? createElement('div', { role: 'alert' }, children) : null,
  Button: ({ children, onPress, busy, disabled }: { children: ReactNode; onPress: () => void; busy?: boolean; disabled?: boolean }) => createElement('button', { onClick: onPress, disabled: busy || disabled }, children),
  TextAction: ({ children, onPress }: { children: ReactNode; onPress: () => void }) => createElement('button', { onClick: onPress }, children),
  Sheet: ({ children, onClose, busy }: { children: ReactNode; onClose: () => void; busy: boolean }) => createElement('div', null,
    createElement('button', { onClick: onClose, disabled: busy }, 'Close sheet'), children),
}));
import { ImportSheet } from './ImportSheet';

beforeEach(() => {
  vi.resetAllMocks();
  imports.resumeImport.mockResolvedValue(null);
  // A picker requested during iOS modal presentation can remain unresolved.
  imports.chooseImport.mockImplementation(() => new Promise(() => {}));
});
afterEach(cleanup);

it('finishes opening after sign-in without requesting Files during sheet presentation', async () => {
  const onClose = vi.fn();
  render(createElement(ImportSheet, { userId: 'account', onClose, onImported: vi.fn() }));
  await waitFor(() => expect(imports.resumeImport).toHaveBeenCalledWith('account'));
  await act(async () => {});
  expect(imports.chooseImport).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Choose Anki file' }).hasAttribute('disabled')).toBe(false);
  expect(screen.queryByRole('progressbar')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Close sheet' }));
  expect(onClose).toHaveBeenCalledOnce();
});

it('opens Files only on a tap and lets the user retry after canceling', async () => {
  imports.chooseImport.mockResolvedValue(null);
  render(createElement(ImportSheet, { userId: 'account', onClose: vi.fn(), onImported: vi.fn() }));
  await act(async () => {});
  expect(imports.chooseImport).not.toHaveBeenCalled();
  const choose = screen.getByRole('button', { name: 'Choose Anki file' });
  fireEvent.click(choose);
  await waitFor(() => expect(imports.chooseImport).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(choose.hasAttribute('disabled')).toBe(false));
  fireEvent.click(choose);
  await waitFor(() => expect(imports.chooseImport).toHaveBeenCalledTimes(2));
});

it('keeps an interrupted import available without reopening Files', async () => {
  imports.resumeImport.mockResolvedValue({
    plan: { decks: [], skipped: 0, suspended: 0 },
    job: { name: 'saved.apkg', selected: [], mapped: {}, language: 'es' },
  });
  render(createElement(ImportSheet, { userId: 'account', onClose: vi.fn(), onImported: vi.fn() }));
  await screen.findByText('saved.apkg');
  expect(imports.chooseImport).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Close sheet' }).hasAttribute('disabled')).toBe(false);
});
