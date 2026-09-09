// ============================================================
// Проверка подключения к Jira / Confluence для индикаторов.
// Демо-режим эмулирует успешный пинг; реальный режим честно
// показывает недоступность (браузер не ходит на самоподписанные
// SSL напрямую — в целевой архитектуре это делает FastAPI-прокси
// с verify=False, timeout=10 и кэшем ttl=300).
// ============================================================

export type ConnStatus = 'checking' | 'ok' | 'demo' | 'error' | 'nocreds';

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function pingIntegration(url: string, hasCreds: boolean, demo: boolean): Promise<ConnStatus> {
  if (demo) {
    await delay(450 + Math.random() * 350);
    return 'demo';
  }
  if (!hasCreds) return 'nocreds';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2600);
    await fetch(url, { signal: ctrl.signal, mode: 'no-cors' });
    clearTimeout(t);
    return 'ok';
  } catch {
    return 'error';
  }
}
