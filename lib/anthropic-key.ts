const KEY = "lingobot_anthropic_key";

export function saveAnthropicKey(key: string) {
  localStorage.setItem(KEY, key);
}

export function getAnthropicKey(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearAnthropicKey() {
  localStorage.removeItem(KEY);
}
