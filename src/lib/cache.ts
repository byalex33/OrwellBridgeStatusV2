interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  staleTime?: number; // Time when data becomes stale but still usable
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private pendingRequests = new Map<string, Promise<unknown>>();

  set<T>(key: string, data: T, ttlSeconds: number = 600, staleSeconds?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000,
      staleTime: staleSeconds !== undefined ? staleSeconds * 1000 : undefined
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  // Get with stale-while-revalidate support
  getWithStale<T>(key: string): { data: T | null; isStale: boolean } {
    const entry = this.cache.get(key);
    if (!entry) return { data: null, isStale: false };

    const now = Date.now();
    const age = now - entry.timestamp;

    // Data is expired, delete and return null
    if (age > entry.ttl) {
      this.cache.delete(key);
      return { data: null, isStale: false };
    }

    // Data is stale but still within TTL
    const staleTime = entry.staleTime ?? entry.ttl;
    const isStale = age > staleTime;

    return { data: entry.data as T, isStale };
  }

  // Deduplicate concurrent requests for the same key
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = 600,
    staleSeconds?: number
  ): Promise<T> {
    // Check if we have fresh data
    const cached = this.getWithStale<T>(key);
    if (this.cache.has(key) && !cached.isStale) return cached.data as T;

    // Check if there's already a pending request for this key
    const pending = this.pendingRequests.get(key);
    if (pending) {
      return pending as Promise<T>;
    }

    // Create new request
    const promise = Promise.resolve().then(fetchFn).then(data => {
      if (this.pendingRequests.get(key) === promise) {
        this.set(key, data, ttlSeconds, staleSeconds);
        this.pendingRequests.delete(key);
      }
      return data;
    }).catch(error => {
      if (this.pendingRequests.get(key) === promise) this.pendingRequests.delete(key);
      throw error;
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  clear(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.pendingRequests.delete(key);
  }
}

export const cache = new SimpleCache();