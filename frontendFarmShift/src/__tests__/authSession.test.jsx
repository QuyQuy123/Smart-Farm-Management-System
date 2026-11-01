import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { getProfile } from '../services/userService';
import { getAuthToken } from '../utils/authStorage';

vi.mock('../services/userService', () => ({ getProfile: vi.fn() }));

const token = (exp = Math.floor(Date.now() / 1000) + 3600) =>
  `e30.${btoa(JSON.stringify({ sub: 'owner@farm.test', roles: ['ROLE_FARM_OWNER'], exp }))}.signature`;

const Session = () => {
  const { user, loading, logout } = useAuth();
  return <><span>{loading ? 'loading' : user?.email || 'signed out'}</span><button onClick={logout}>Logout</button></>;
};

beforeEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  getProfile.mockReset().mockResolvedValue({ fullName: 'Owner' });
});

describe('shared authentication session', () => {
  it('restores login in a new tab with no sessionStorage', async () => {
    localStorage.setItem('token', token());
    render(<AuthProvider><Session /></AuthProvider>);
    expect(await screen.findByText('owner@farm.test')).toBeTruthy();
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(getProfile).toHaveBeenCalled();
  });

  it('migrates the existing tab session into shared storage', () => {
    const existing = token();
    sessionStorage.setItem('token', existing);
    expect(getAuthToken()).toBe(existing);
    expect(localStorage.getItem('token')).toBe(existing);
    expect(sessionStorage.getItem('token')).toBeNull();
  });

  it('clears shared credentials when logging out', async () => {
    localStorage.setItem('token', token());
    render(<AuthProvider><Session /></AuthProvider>);
    await screen.findByText('owner@farm.test');
    fireEvent.click(screen.getByText('Logout'));
    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByText('signed out')).toBeTruthy();
  });

  it('restores login when another tab signs in', async () => {
    render(<AuthProvider><Session /></AuthProvider>);
    act(() => {
      localStorage.setItem('token', token());
      window.dispatchEvent(new StorageEvent('storage', { key: 'token', storageArea: localStorage }));
    });
    expect(await screen.findByText('owner@farm.test')).toBeTruthy();
  });

  it('rejects expired and malformed tokens', () => {
    for (const invalid of [token(1), 'invalid-token']) {
      localStorage.setItem('token', invalid);
      const view = render(<AuthProvider><Session /></AuthProvider>);
      expect(screen.getByText('signed out')).toBeTruthy();
      expect(localStorage.getItem('token')).toBeNull();
      view.unmount();
    }
  });

  it('signs out when another tab logs out, even with a pending profile request', async () => {
    let resolveProfile;
    getProfile.mockReturnValue(new Promise(resolve => { resolveProfile = resolve; }));
    localStorage.setItem('token', token());
    render(<AuthProvider><Session /></AuthProvider>);
    act(() => {
      localStorage.removeItem('token');
      window.dispatchEvent(new StorageEvent('storage', { key: 'token', storageArea: localStorage }));
    });
    await act(async () => { resolveProfile({ fullName: 'Owner' }); });
    await waitFor(() => expect(screen.getByText('signed out')).toBeTruthy());
  });
});
