import { describe, expect, it, vi } from 'vitest';
import { needsRefresh, refreshSession, sessionFromTokenHash, trustedHandoff, validateHandoff } from './auth';

describe('extension sign-in', () => {
  it('trusts only the exact web-app connect page', () => {
    expect(trustedHandoff('https://schwankiapp.com/extension-auth?extensionId=x', 'https://schwankiapp.com')).toBe(true);
    expect(trustedHandoff('https://schwankiapp.com/other', 'https://schwankiapp.com')).toBe(false);
    expect(trustedHandoff('https://evil.example/extension-auth', 'https://schwankiapp.com')).toBe(false);
    expect(trustedHandoff('https://user:pw@schwankiapp.com/extension-auth', 'https://schwankiapp.com')).toBe(false);
  });

  it('accepts a token hash and nothing else', () => {
    expect(validateHandoff({ tokenHash: 'a'.repeat(56) })).toBe('a'.repeat(56));
    expect(() => validateHandoff({ tokenHash: 'short' })).toThrow();
    expect(() => validateHandoff({ session: {} })).toThrow();
  });

  it('exchanges the token hash for its own session', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'access', refresh_token: 'refresh', expires_at: 2_000_000_000, user: { id: 'u1', email: 'a@b.c' },
    })));
    const session = await sessionFromTokenHash('https://api', 'key', 'hash', fetchFn);
    expect(session).toEqual({ accessToken: 'access', refreshToken: 'refresh', expiresAt: 2_000_000_000, userId: 'u1', email: 'a@b.c' });
    expect(fetchFn).toHaveBeenCalledWith('https://api/auth/v1/verify', expect.objectContaining({ method: 'POST', body: JSON.stringify({ type: 'magiclink', token_hash: 'hash' }) }));
  });

  it('reports the server message when refresh fails', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({ msg: 'Invalid Refresh Token' }), { status: 400 }));
    await expect(refreshSession('https://api', 'key', { accessToken: 'a', refreshToken: 'r', expiresAt: 0, userId: 'u', email: null }, fetchFn))
      .rejects.toThrow('Invalid Refresh Token');
  });

  it('refreshes ahead of expiry', () => {
    const session = { accessToken: 'a', refreshToken: 'r', expiresAt: 1000, userId: 'u', email: null };
    expect(needsRefresh(session, 600, 500_000)).toBe(true);
    expect(needsRefresh(session, 600, 300_000)).toBe(false);
  });
});
