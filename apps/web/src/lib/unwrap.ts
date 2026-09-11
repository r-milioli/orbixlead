/** Unwrap common API envelope shapes `{ key: T }` or bare `T`. */
export function unwrapList<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && key in data) {
    const value = (data as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value as T[];
  }
  if (data && typeof data === "object" && "items" in data) {
    const value = (data as { items: unknown }).items;
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

export function unwrapOne<T>(data: unknown, key: string): T {
  if (data && typeof data === "object" && key in data) {
    return (data as Record<string, T>)[key];
  }
  return data as T;
}
