import { useEffect, useMemo, useState } from 'react';

interface LiffProfile {
  displayName: string;
  userId: string;
}

interface LiffAuthState {
  ready: boolean;
  enabled: boolean;
  inClient: boolean;
  displayName: string;
  userId: string;
  error: string;
}

const DEFAULT_STATE: LiffAuthState = {
  ready: false,
  enabled: false,
  inClient: false,
  displayName: '',
  userId: '',
  error: ''
};

export function useLiffAuth() {
  const [state, setState] = useState<LiffAuthState>(DEFAULT_STATE);
  const liffId = (import.meta.env.VITE_LIFF_ID as string | undefined) ?? '';

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!liffId.trim()) {
        setState({
          ...DEFAULT_STATE,
          ready: true,
          enabled: false
        });
        return;
      }

      try {
        const liffModule = await import('@line/liff');
        const liff = liffModule.default;

        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        let profile: LiffProfile | null = null;
        try {
          profile = (await liff.getProfile()) as LiffProfile;
        } catch {
          // profile scope may be unavailable; continue as logged in.
        }

        if (cancelled) {
          return;
        }

        setState({
          ready: true,
          enabled: true,
          inClient: liff.isInClient(),
          displayName: profile?.displayName || '',
          userId: profile?.userId || '',
          error: ''
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          ready: true,
          enabled: true,
          inClient: false,
          displayName: '',
          userId: '',
          error: error instanceof Error ? error.message : 'LIFF 初始化失敗'
        });
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [liffId]);

  return useMemo(
    () => ({
      ...state,
      liffId
    }),
    [state, liffId]
  );
}
