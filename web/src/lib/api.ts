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
const BRIDGE_TIMEOUT_MS = 180_000;

interface BridgeEnvelope<TPayload> {
  __gas_bridge: true;
  callbackId: string;
  payload: TPayload;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return JSON.parse(text) as T;
}

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

function createCallbackId() {
  return `gas_bridge_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function isBridgeEnvelope(value: unknown): value is BridgeEnvelope<unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const maybe = value as Record<string, unknown>;
  return maybe.__gas_bridge === true && typeof maybe.callbackId === 'string';
}

async function waitForBridgeMessage<TPayload>(callbackId: string, timeoutMs = BRIDGE_TIMEOUT_MS) {
  return new Promise<TPayload>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('API timeout'));
    }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      if (!isBridgeEnvelope(event.data)) {
        return;
      }
      if (event.data.callbackId !== callbackId) {
        return;
      }

      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve(event.data.payload as TPayload);
    };

    window.addEventListener('message', onMessage);
  });
}

async function requestViaIframeGet<T>(path: string, query?: Record<string, string>) {
  const callbackId = createCallbackId();
  const url = buildUrl(path, query);
  url.searchParams.set('transport', 'postmessage');
  url.searchParams.set('callback_id', callbackId);

  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url.toString();

  const waitPromise = waitForBridgeMessage<T>(callbackId);
  document.body.appendChild(iframe);

  try {
    return await waitPromise;
  } finally {
    iframe.remove();
  }
}

async function requestViaIframePost<T>(path: string, payload: Record<string, unknown>) {
  const callbackId = createCallbackId();
  const url = buildUrl(path);
  url.searchParams.set('transport', 'postmessage');
  url.searchParams.set('callback_id', callbackId);

  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.name = callbackId;

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url.toString();
  form.target = callbackId;
  form.style.display = 'none';

  const payloadInput = document.createElement('input');
  payloadInput.type = 'hidden';
  payloadInput.name = 'payload';
  payloadInput.value = JSON.stringify(withToken(payload));
  form.appendChild(payloadInput);

  const waitPromise = waitForBridgeMessage<T>(callbackId);
  document.body.appendChild(iframe);
  document.body.appendChild(form);

  try {
    form.submit();
    return await waitPromise;
  } finally {
    form.remove();
    iframe.remove();
  }
}

async function requestViaFetchGet<T>(path: string, query?: Record<string, string>) {
  const response = await fetchWithTimeout(buildUrl(path, query).toString(), {
    headers: {
      'X-API-TOKEN': API_TOKEN
    }
  });
  return parseJsonResponse<T>(response);
}

async function requestViaFetchSimplePost<T>(
  path: string,
  payload: Record<string, unknown>,
  timeoutMs = 120_000
) {
  const response = await fetchWithTimeout(
    buildUrl(path).toString(),
    {
      method: 'POST',
      // Do not set custom headers to avoid CORS preflight in LIFF/webview.
      body: JSON.stringify(withToken(payload))
    },
    timeoutMs
  );
  return parseJsonResponse<T>(response);
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Fetch timeout');
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function shouldFallbackToIframe(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof Error &&
      (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')))
  );
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

export async function addCard(input: { imageBase64: string; filename?: string }) {
  try {
    return await requestViaFetchSimplePost<{ ok: boolean; id: string; fields: Partial<CardFields> }>(
      'add',
      input
    );
  } catch (error) {
    if (!shouldFallbackToIframe(error)) {
      throw error;
    }
    return requestViaIframePost<{ ok: boolean; id: string; fields: Partial<CardFields> }>(
      'add',
      input
    );
  }
}

export async function updateCard(id: string, fields: Partial<CardFields>) {
  const payload = { id, fields: toUpdatePayload(fields) };
  try {
    return await requestViaFetchSimplePost<{ ok: boolean }>('update', payload);
  } catch (error) {
    if (!shouldFallbackToIframe(error)) {
      throw error;
    }
    return requestViaIframePost<{ ok: boolean }>('update', payload);
  }
}

export async function searchCards(params: SearchParams) {
  const query = {
    q: params.q,
    company: params.company,
    tag: params.tag,
    from: params.from,
    to: params.to,
    sort: params.sort
  };
  try {
    return await requestViaFetchGet<{ ok: boolean; items: CardRecord[] }>('search', query);
  } catch (error) {
    if (!shouldFallbackToIframe(error)) {
      throw error;
    }
    return requestViaIframeGet<{ ok: boolean; items: CardRecord[] }>('search', query);
  }
}

export async function getCard(id: string) {
  const query = { id };
  try {
    return await requestViaFetchGet<{ ok: boolean; item: CardRecord }>('get', query);
  } catch (error) {
    if (!shouldFallbackToIframe(error)) {
      throw error;
    }
    return requestViaIframeGet<{ ok: boolean; item: CardRecord }>('get', query);
  }
}
