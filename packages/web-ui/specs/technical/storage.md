# Storage

IndexedDB schema and data persistence for browser-side storage.

## Overview

All persistent data is stored in IndexedDB:
- API keys and provider credentials
- User settings and preferences
- Browser-mode session data
- Remote session cache for offline viewing
- Connection profiles

## Database Schema

### Database Structure

```typescript
interface PiWebUIDatabase {
  name: 'pi-web-ui';
  version: 1;
  stores: {
    settings: SettingsStore;
    providerKeys: ProviderKeysStore;
    sessions: SessionsStore;
    sessionMetadata: SessionMetadataStore;
    connections: ConnectionsStore;
    sessionCache: SessionCacheStore;
  };
}
```

### Store Definitions

```typescript
// Settings store - single record with all settings
interface SettingsStore {
  keyPath: 'id';
  indexes: [];
  schema: {
    id: 'settings';  // Always 'settings'
    theme: 'light' | 'dark' | 'system';
    fontSize: 'sm' | 'md' | 'lg';
    defaultModel: string | null;
    defaultThinkingLevel: ThinkingLevel;
    autoCompaction: boolean;
    autoRetry: boolean;
    showTimestamps: boolean;
    collapseThinking: boolean;
    proxy: {
      enabled: boolean;
      url: string;
    };
  };
}

// Provider API keys
interface ProviderKeysStore {
  keyPath: 'provider';
  indexes: [];
  schema: {
    provider: string;           // 'anthropic', 'openai', etc.
    key: string;                // API key (encrypted at rest by browser)
    addedAt: string;            // ISO timestamp
  };
}

// Full session data (browser mode only)
interface SessionsStore {
  keyPath: 'id';
  indexes: ['lastModified'];
  schema: {
    id: string;                 // UUID
    title: string;
    model: Model | null;
    thinkingLevel: ThinkingLevel;
    messages: AgentMessage[];
    artifacts: Artifact[];
    createdAt: string;
    lastModified: string;
  };
}

// Session metadata (for fast list loading)
interface SessionMetadataStore {
  keyPath: 'id';
  indexes: ['lastModified', 'createdAt'];
  schema: {
    id: string;
    title: string;
    preview: string;            // First message snippet
    messageCount: number;
    modelId: string | null;
    thinkingLevel: ThinkingLevel;
    createdAt: string;
    lastModified: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
      cost: number;
    };
  };
}

// Remote connection profiles
interface ConnectionsStore {
  keyPath: 'id';
  indexes: ['lastUsed'];
  schema: {
    id: string;                 // UUID
    name: string;               // Display name
    url: string;                // WebSocket URL
    token: string;              // Auth token
    lastUsed: string;           // ISO timestamp
    lastSessionPath?: string;   // Last opened session
  };
}

// Cached remote sessions (for offline viewing)
interface SessionCacheStore {
  keyPath: 'cacheKey';
  indexes: ['connectionId', 'cachedAt'];
  schema: {
    cacheKey: string;           // `${connectionId}:${sessionPath}`
    connectionId: string;
    sessionPath: string;
    sessionId: string;
    messages: AgentMessage[];
    model: Model | null;
    thinkingLevel: ThinkingLevel;
    artifacts: Artifact[];
    cachedAt: string;
  };
}
```

## Database Initialization

```typescript
const DB_NAME = 'pi-web-ui';
const DB_VERSION = 1;

async function initDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = request.result;
      
      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
      
      // Provider keys store
      if (!db.objectStoreNames.contains('providerKeys')) {
        db.createObjectStore('providerKeys', { keyPath: 'provider' });
      }
      
      // Sessions store
      if (!db.objectStoreNames.contains('sessions')) {
        const sessionsStore = db.createObjectStore('sessions', { keyPath: 'id' });
        sessionsStore.createIndex('lastModified', 'lastModified');
      }
      
      // Session metadata store
      if (!db.objectStoreNames.contains('sessionMetadata')) {
        const metadataStore = db.createObjectStore('sessionMetadata', { keyPath: 'id' });
        metadataStore.createIndex('lastModified', 'lastModified');
        metadataStore.createIndex('createdAt', 'createdAt');
      }
      
      // Connections store
      if (!db.objectStoreNames.contains('connections')) {
        const connectionsStore = db.createObjectStore('connections', { keyPath: 'id' });
        connectionsStore.createIndex('lastUsed', 'lastUsed');
      }
      
      // Session cache store
      if (!db.objectStoreNames.contains('sessionCache')) {
        const cacheStore = db.createObjectStore('sessionCache', { keyPath: 'cacheKey' });
        cacheStore.createIndex('connectionId', 'connectionId');
        cacheStore.createIndex('cachedAt', 'cachedAt');
      }
    };
  });
}
```

## Storage Service

```typescript
interface StorageService {
  settings: SettingsService;
  providerKeys: ProviderKeysService;
  sessions: SessionsService;
  connections: ConnectionsService;
  sessionCache: SessionCacheService;
}

// Settings service
interface SettingsService {
  get(): Promise<Settings>;
  set(settings: Partial<Settings>): Promise<void>;
}

// Provider keys service
interface ProviderKeysService {
  get(provider: string): Promise<string | null>;
  set(provider: string, key: string): Promise<void>;
  remove(provider: string): Promise<void>;
  getAll(): Promise<ProviderKey[]>;
  clearAll(): Promise<void>;
}

// Sessions service
interface SessionsService {
  get(id: string): Promise<Session | null>;
  save(session: Session): Promise<void>;
  delete(id: string): Promise<void>;
  getAllMetadata(): Promise<SessionMetadata[]>;
  search(query: string): Promise<SessionMetadata[]>;
}

// Connections service
interface ConnectionsService {
  get(id: string): Promise<ConnectionProfile | null>;
  save(connection: ConnectionProfile): Promise<void>;
  delete(id: string): Promise<void>;
  getAll(): Promise<ConnectionProfile[]>;
  updateLastUsed(id: string): Promise<void>;
}

// Session cache service
interface SessionCacheService {
  get(connectionId: string, sessionPath: string): Promise<CachedSession | null>;
  set(cache: CachedSession): Promise<void>;
  delete(connectionId: string, sessionPath: string): Promise<void>;
  deleteByConnection(connectionId: string): Promise<void>;
  pruneOld(maxAge: number): Promise<void>;
}
```

## Implementation Examples

### Settings Service

```typescript
class SettingsServiceImpl implements SettingsService {
  private db: IDBDatabase;
  private cache: Settings | null = null;
  
  constructor(db: IDBDatabase) {
    this.db = db;
  }
  
  async get(): Promise<Settings> {
    if (this.cache) return this.cache;
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const request = store.get('settings');
      
      request.onsuccess = () => {
        this.cache = request.result ?? DEFAULT_SETTINGS;
        resolve(this.cache);
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  async set(updates: Partial<Settings>): Promise<void> {
    const current = await this.get();
    const updated = { ...current, ...updates, id: 'settings' };
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const request = store.put(updated);
      
      request.onsuccess = () => {
        this.cache = updated;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
}
```

### Sessions Service

```typescript
class SessionsServiceImpl implements SessionsService {
  private db: IDBDatabase;
  
  constructor(db: IDBDatabase) {
    this.db = db;
  }
  
  async save(session: Session): Promise<void> {
    const tx = this.db.transaction(['sessions', 'sessionMetadata'], 'readwrite');
    
    // Save full session
    const sessionsStore = tx.objectStore('sessions');
    sessionsStore.put(session);
    
    // Save metadata
    const metadataStore = tx.objectStore('sessionMetadata');
    metadataStore.put(this.extractMetadata(session));
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  
  async getAllMetadata(): Promise<SessionMetadata[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('sessionMetadata', 'readonly');
      const store = tx.objectStore('sessionMetadata');
      const index = store.index('lastModified');
      const request = index.openCursor(null, 'prev');  // Descending
      
      const results: SessionMetadata[] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
  
  private extractMetadata(session: Session): SessionMetadata {
    return {
      id: session.id,
      title: session.title,
      preview: this.generatePreview(session.messages),
      messageCount: session.messages.length,
      modelId: session.model?.id ?? null,
      thinkingLevel: session.thinkingLevel,
      createdAt: session.createdAt,
      lastModified: session.lastModified,
      usage: this.calculateUsage(session.messages),
    };
  }
  
  private generatePreview(messages: AgentMessage[]): string {
    const firstUserMessage = messages.find(m => 
      m.role === 'user' || m.role === 'user-with-attachments'
    );
    if (!firstUserMessage) return '';
    
    const text = extractText(firstUserMessage.content);
    return text.length > 100 ? text.slice(0, 97) + '...' : text;
  }
}
```

## Storage Quota Management

### Quota Checking

```typescript
async function checkStorageQuota(): Promise<{
  usage: number;
  quota: number;
  percentUsed: number;
}> {
  if (!navigator.storage?.estimate) {
    return { usage: 0, quota: 0, percentUsed: 0 };
  }
  
  const estimate = await navigator.storage.estimate();
  return {
    usage: estimate.usage ?? 0,
    quota: estimate.quota ?? 0,
    percentUsed: estimate.usage && estimate.quota
      ? (estimate.usage / estimate.quota) * 100
      : 0,
  };
}
```

### Quota Warning

```typescript
const QUOTA_WARNING_THRESHOLD = 80;  // 80%

async function checkQuotaAndWarn(): Promise<void> {
  const { percentUsed } = await checkStorageQuota();
  
  if (percentUsed > QUOTA_WARNING_THRESHOLD) {
    showBanner({
      type: 'warning',
      message: `Storage ${Math.round(percentUsed)}% full. Consider deleting old sessions.`,
      action: { label: 'Manage', onClick: openStorageManager },
    });
  }
}
```

### Storage Cleanup

```typescript
interface CleanupOptions {
  maxAge?: number;              // Max age in days
  maxSessions?: number;         // Max number of sessions to keep
  maxCacheSize?: number;        // Max cache size in bytes
}

async function cleanupStorage(options: CleanupOptions): Promise<number> {
  let deletedCount = 0;
  
  // Delete old sessions
  if (options.maxAge) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - options.maxAge);
    
    const metadata = await storage.sessions.getAllMetadata();
    for (const session of metadata) {
      if (new Date(session.lastModified) < cutoff) {
        await storage.sessions.delete(session.id);
        deletedCount++;
      }
    }
  }
  
  // Limit session count
  if (options.maxSessions) {
    const metadata = await storage.sessions.getAllMetadata();
    if (metadata.length > options.maxSessions) {
      const toDelete = metadata.slice(options.maxSessions);
      for (const session of toDelete) {
        await storage.sessions.delete(session.id);
        deletedCount++;
      }
    }
  }
  
  // Prune session cache
  if (options.maxAge) {
    await storage.sessionCache.pruneOld(options.maxAge * 24 * 60 * 60 * 1000);
  }
  
  return deletedCount;
}
```

## Data Migration

### Version Upgrades

```typescript
const migrations: Record<number, (db: IDBDatabase, tx: IDBTransaction) => void> = {
  // Version 1 -> 2 example
  2: (db, tx) => {
    // Add new index
    const store = tx.objectStore('sessions');
    store.createIndex('modelId', 'modelId');
  },
  
  // Version 2 -> 3 example
  3: (db, tx) => {
    // Create new store
    db.createObjectStore('preferences', { keyPath: 'key' });
  },
};

function handleUpgrade(
  db: IDBDatabase,
  oldVersion: number,
  newVersion: number,
  tx: IDBTransaction
): void {
  for (let v = oldVersion + 1; v <= newVersion; v++) {
    if (migrations[v]) {
      migrations[v](db, tx);
    }
  }
}
```

## Import/Export

### Export All Data

```typescript
interface ExportData {
  version: number;
  exportedAt: string;
  settings: Settings;
  sessions: Session[];
  connections: ConnectionProfile[];
  // Note: API keys NOT exported for security
}

async function exportData(): Promise<ExportData> {
  const settings = await storage.settings.get();
  const metadata = await storage.sessions.getAllMetadata();
  const sessions = await Promise.all(
    metadata.map(m => storage.sessions.get(m.id))
  );
  const connections = await storage.connections.getAll();
  
  return {
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    sessions: sessions.filter((s): s is Session => s !== null),
    connections: connections.map(c => ({ ...c, token: '' })),  // Redact tokens
  };
}
```

### Import Data

```typescript
async function importData(data: ExportData): Promise<ImportResult> {
  const result: ImportResult = {
    settingsImported: false,
    sessionsImported: 0,
    connectionsImported: 0,
    errors: [],
  };
  
  // Import settings
  try {
    await storage.settings.set(data.settings);
    result.settingsImported = true;
  } catch (e) {
    result.errors.push(`Settings: ${e.message}`);
  }
  
  // Import sessions
  for (const session of data.sessions) {
    try {
      await storage.sessions.save(session);
      result.sessionsImported++;
    } catch (e) {
      result.errors.push(`Session ${session.id}: ${e.message}`);
    }
  }
  
  // Import connections (without tokens)
  for (const connection of data.connections) {
    try {
      await storage.connections.save(connection);
      result.connectionsImported++;
    } catch (e) {
      result.errors.push(`Connection ${connection.id}: ${e.message}`);
    }
  }
  
  return result;
}
```

## Offline Support

### Service Worker Cache

```typescript
// Cache strategy for static assets
const CACHE_NAME = 'pi-web-ui-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  // ...
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
```

### Offline Detection

```typescript
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    function handleOnline() { setIsOnline(true); }
    function handleOffline() { setIsOnline(false); }
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOnline;
}
```

### Offline Queue

```typescript
interface OfflineQueueItem {
  id: string;
  type: 'message' | 'setting';
  data: unknown;
  createdAt: string;
}

async function queueForSync(item: OfflineQueueItem): Promise<void> {
  const tx = db.transaction('offlineQueue', 'readwrite');
  const store = tx.objectStore('offlineQueue');
  await store.add(item);
}

async function processOfflineQueue(): Promise<void> {
  const tx = db.transaction('offlineQueue', 'readwrite');
  const store = tx.objectStore('offlineQueue');
  const items = await store.getAll();
  
  for (const item of items) {
    try {
      await syncItem(item);
      await store.delete(item.id);
    } catch (e) {
      console.error(`Failed to sync item ${item.id}:`, e);
    }
  }
}
```

## Error Handling

| Error | Handling |
|-------|----------|
| QuotaExceededError | Prompt to delete old data |
| InvalidStateError | Reconnect to database |
| TransactionInactiveError | Retry operation |
| VersionError | Clear and reinitialize |
| Unknown | Log and notify user |

```typescript
async function handleStorageError(error: Error, operation: string): Promise<void> {
  console.error(`Storage error during ${operation}:`, error);
  
  if (error.name === 'QuotaExceededError') {
    showBanner({
      type: 'error',
      message: 'Storage full. Please delete some conversations.',
      action: { label: 'Manage Storage', onClick: openStorageManager },
    });
  } else if (error.name === 'InvalidStateError') {
    // Database connection lost, reinitialize
    await initDatabase();
  } else {
    toast.error(`Storage error: ${error.message}`);
  }
}
```
