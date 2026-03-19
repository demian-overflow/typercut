import { useEffect } from 'react';
import { setToken } from '../lib/auth';

/**
 * Rendered at the root on any page load.
 * If the URL contains ?token=..., stash it in localStorage and strip it from
 * the URL so it doesn't sit in browser history.
 */
export function useHandleAuthCallback(onToken: () => void) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) return;

    setToken(token);

    // Remove ?token= from the URL without triggering a navigation.
    params.delete('token');
    const clean =
      window.location.pathname + (params.size ? `?${params}` : '');
    window.history.replaceState({}, '', clean);

    onToken();
  }, [onToken]);
}
