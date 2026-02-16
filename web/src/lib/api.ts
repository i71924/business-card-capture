import type { CardFields, CardRecord, SearchParams } from '../types';

function requiredEnv(name: 'VITE_API_BASE' | 'VITE_API_TOKEN') {
  const value = import.meta.env[name] as string | undefined;
  if (!value) {
    throw new Error(`Missing ${name} in .env`);
  }
  return value;
}

const API_BASE = requiredEnv('VITE_API_BASE');
const API_TOKEN = requiredEnv('VITE_API_TOKEN');
const ADD_POLL_TIMEOUT_MS = 180_000;
const ADD_POLL_INTERVAL_MS = 2_000;

function buildUrl(path: string, query?: Record<string, string>) {
  const url = new URL(API_BASE);
  url.searchParams.set('path', path);
  url.searchParams.set('api_token', API_TOKEN);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });
  }
  return url;
}

function withToken(payload: Record<string, unknown>) {
  return {
    ...payload,
    api_token: API_TOKEN
  };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function postNoCors(path: string, payload: Record<string, unknown>, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    await fetch(buildUrl(path).toString(), {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify(withToken(payload)),
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('POST timeout');
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function requestViaJsonp<T>(path: string, query?: Record<string, string>, timeoutMs = 15_000) {
  return new Promise<T>((resolve, reject) => {
    const callbackId = `cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const callbackRoot = '__gasJsonpCallbacks';
    const callbackName = `${callbackRoot}.${callbackId}`;

    const store = (window as unknown as Record<string, unknown>)[callbackRoot] as
      | Record<string, (payload: T) => void>
      | undefined;

    const callbacks = store || {};
    (window as unknown as Record<string, unknown>)[callbackRoot] = callbacks;

    const url = buildUrl(path, {
      ...(query || {}),
      callback: callbackName
    });

    const script = document.createElement('script');
    let done = false;

    const cleanup = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      delete callbacks[callbackId];
      script.remove();
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('JSONP timeout'));
    }, timeoutMs);

    callbacks[callbackId] = (payload: T) => {
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('JSONP network error'));
    };

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

function toUpdatePayload(fields: Partial<CardFields>) {
  return {
    name: fields.name ?? '',
    company: fields.company ?? '',
    title: fields.title ?? '',
    phone: fields.phone ?? '',
    email: fields.email ?? '',
    address: fields.address ?? '',
    website: fields.website ?? '',
    tags: fields.tags ?? '',
    notes: fields.notes ?? ''
  };
}

async function fetchNewestCard() {
  const result = await requestViaJsonp<{ ok: boolean; items: CardRecord[]; error?: string }>('search', {
    sort: 'newest'
  });

  if (!result.ok) {
    throw new Error(result.error || 'search failed');
  }

  return result.items[0] || null;
}

export async function addCard(input: { imageBase64: string; filename?: string }) {
  const before = await fetchNewestCard().catch(() => null);
  const beforeId = before?.id || '';
  const startedAt = Date.now();

  try {
    await postNoCors('add', input, 30_000);
  } catch {
    throw new Error('add 網路請求失敗。請確認 GAS Web App 已重新部署且 API_BASE/API_TOKEN 正確。');
  }

  while (Date.now() - startedAt < ADD_POLL_TIMEOUT_MS) {
    await sleep(ADD_POLL_INTERVAL_MS);

    const latest = await fetchNewestCard().catch(() => null);
    if (!latest) {
      continue;
    }

    if (beforeId && latest.id === beforeId) {
      continue;
    }

    const createdAtTs = new Date(latest.created_at).getTime();
    if (!beforeId && !Number.isNaN(createdAtTs) && createdAtTs < startedAt - 10_000) {
      continue;
    }

    return {
      ok: true,
      id: latest.id,
      fields: {
        name: latest.name,
        company: latest.company,
        title: latest.title,
        phone: latest.phone,
        email: latest.email,
        address: latest.address,
        website: latest.website,
        tags: latest.tags,
        notes: latest.notes
      }
    };
  }

  throw new Error('API timeout（add 已送出但未在期限內讀到新資料）');
}

export async function updateCard(id: string, fields: Partial<CardFields>) {
  try {
    await postNoCors('update', { id, fields: toUpdatePayload(fields) }, 20_000);
    return { ok: true };
  } catch {
    throw new Error('update 網路請求失敗。請確認 GAS Web App 已重新部署且 API_BASE/API_TOKEN 正確。');
  }
}

export async function searchCards(params: SearchParams) {
  return requestViaJsonp<{ ok: boolean; items: CardRecord[]; error?: string }>('search', {
    q: params.q,
    company: params.company,
    tag: params.tag,
    from: params.from,
    to: params.to,
    sort: params.sort
  });
}

export async function getCard(id: string) {
  return requestViaJsonp<{ ok: boolean; item: CardRecord; error?: string }>('get', { id });
}
