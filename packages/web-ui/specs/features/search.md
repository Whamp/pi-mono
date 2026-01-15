# Search

Search functionality for finding content across conversations and within the current session.

## Overview

Search enables users to:
- Find specific messages across all conversations (global search)
- Search within the current conversation (local search)
- Navigate to matched results
- Filter by message type, date, and other criteria

## Search Types

### Global Search (Sidebar)

Searches across all sessions:

```
┌─────────────────────────────────────┐
│ 🔍 [Search conversations...     ]   │
├─────────────────────────────────────┤
│ Results for "authentication"        │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Refactor auth module            │ │
│ │ "...fix the authentication     │ │
│ │ flow to support OAuth2..."      │ │
│ │ Today, 2:30 PM                  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Debug login issue               │ │
│ │ "...authentication token        │ │
│ │ expired prematurely..."         │ │
│ │ Yesterday, 11:00 AM             │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 5 matches in 3 conversations        │
└─────────────────────────────────────┘
```

### Local Search (Chat)

Searches within current conversation:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [≡]  Session Title       🔍 [Find in conversation...]  [⚙️]  [🌓]         │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  🔍 [token                    ] [×]     ◀ 2/8 ▶     [Match case] [Regex]   │
└────────────────────────────────────────────────────────────────────────────┘
```

## Data Types

```typescript
interface SearchQuery {
  text: string;
  options: SearchOptions;
}

interface SearchOptions {
  caseSensitive: boolean;
  regex: boolean;
  wholeWord: boolean;
  scope: 'all' | 'current' | 'project';
  filters: SearchFilters;
}

interface SearchFilters {
  dateRange?: {
    start: string;  // ISO date
    end: string;
  };
  messageType?: ('user' | 'assistant' | 'tool')[];
  hasAttachments?: boolean;
  model?: string[];
}

interface SearchResult {
  sessionId: string;
  sessionTitle: string;
  messageId: string;
  messageRole: 'user' | 'assistant';
  content: string;
  matchPositions: MatchPosition[];
  timestamp: string;
  preview: string;  // Snippet with match highlighted
}

interface MatchPosition {
  start: number;
  end: number;
}
```

## Global Search

### Search Flow

```
1. User types in sidebar search
2. Debounce input (300ms)
3. Query IndexedDB / server
4. Display results grouped by session
5. Click result → navigate to session + message
```

### Implementation

```typescript
async function searchAllSessions(query: SearchQuery): Promise<SearchResult[]> {
  if (mode === 'browser') {
    return searchIndexedDB(query);
  } else {
    return searchRemote(query);
  }
}

async function searchIndexedDB(query: SearchQuery): Promise<SearchResult[]> {
  const sessions = await storage.sessions.getAll();
  const results: SearchResult[] = [];
  
  for (const session of sessions) {
    for (const message of session.messages) {
      const matches = findMatches(message.content, query);
      if (matches.length > 0) {
        results.push({
          sessionId: session.id,
          sessionTitle: session.title,
          messageId: message.id,
          messageRole: message.role,
          content: extractText(message.content),
          matchPositions: matches,
          timestamp: message.timestamp,
          preview: generatePreview(message.content, matches[0]),
        });
      }
    }
  }
  
  // Sort by relevance and recency
  return sortResults(results);
}

async function searchRemote(query: SearchQuery): Promise<SearchResult[]> {
  const response = await adapter.sendCommand({
    type: 'search_sessions',
    query: query.text,
    options: query.options,
  });
  return response.data.results;
}
```

### Result Display

```typescript
interface SearchResultItemProps {
  result: SearchResult;
  query: string;
  onClick: () => void;
}
```

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ 💬 Refactor auth module                                     │
│                                                             │
│ "...the [authentication] flow needs to handle              │
│ token refresh properly..."                                  │
│                                                             │
│ Today, 2:30 PM · User message                              │
└─────────────────────────────────────────────────────────────┘
```

**Highlighting:**
```typescript
function highlightMatches(text: string, matches: MatchPosition[]): ReactNode {
  const parts: ReactNode[] = [];
  let lastEnd = 0;
  
  for (const match of matches) {
    // Text before match
    if (match.start > lastEnd) {
      parts.push(text.slice(lastEnd, match.start));
    }
    // Highlighted match
    parts.push(
      <mark key={match.start}>
        {text.slice(match.start, match.end)}
      </mark>
    );
    lastEnd = match.end;
  }
  
  // Text after last match
  if (lastEnd < text.length) {
    parts.push(text.slice(lastEnd));
  }
  
  return parts;
}
```

### Navigation

```typescript
async function navigateToResult(result: SearchResult): Promise<void> {
  // Switch to session if different
  if (currentSessionId !== result.sessionId) {
    await loadSession(result.sessionId);
  }
  
  // Scroll to message
  scrollToMessage(result.messageId);
  
  // Highlight message briefly
  highlightMessage(result.messageId, 2000);
  
  // Close search (mobile)
  if (isMobile) {
    closeSidebar();
  }
}
```

## Local Search (In-Conversation)

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+F` | Open find bar |
| `Enter` | Next match |
| `Shift+Enter` | Previous match |
| `Escape` | Close find bar |
| `F3` | Next match |
| `Shift+F3` | Previous match |

### Find Bar

```typescript
interface FindBarProps {
  isOpen: boolean;
  query: string;
  currentMatch: number;
  totalMatches: number;
  options: {
    caseSensitive: boolean;
    regex: boolean;
  };
  onQueryChange: (query: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  onOptionsChange: (options: Partial<typeof options>) => void;
}
```

**Layout:**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ 🔍 [authentication             ] [×]    ◀ 3/12 ▶    [Aa] [.*]  [whole]    │
└────────────────────────────────────────────────────────────────────────────┘
     Input                         Close   Navigation   Options
```

**Options:**
- `[Aa]` - Match case
- `[.*]` - Regex mode
- `[whole]` - Whole word only

### Match Navigation

```typescript
interface FindState {
  matches: MessageMatch[];
  currentIndex: number;
}

interface MessageMatch {
  messageId: string;
  positions: MatchPosition[];
}

function navigateToMatch(direction: 'next' | 'prev'): void {
  const newIndex = direction === 'next'
    ? (state.currentIndex + 1) % state.matches.length
    : (state.currentIndex - 1 + state.matches.length) % state.matches.length;
  
  setState({ currentIndex: newIndex });
  
  const match = state.matches[newIndex];
  scrollToMessage(match.messageId);
  highlightMatch(match);
}
```

### In-Message Highlighting

All matches highlighted in messages, current match emphasized:

```
┌─────────────────────────────────────────────────────────────┐
│ Assistant                                                   │
│                                                             │
│ The [authentication] system uses JWT tokens. When the       │
│ user logs in, the [AUTHENTICATION] middleware validates     │ ← Current match (yellow)
│ the credentials and returns an [authentication] token.      │ ← Other matches (faded yellow)
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**CSS:**
```css
.search-match {
  background-color: var(--color-search-match);
  border-radius: 2px;
}

.search-match-current {
  background-color: var(--color-search-match-current);
  outline: 2px solid var(--color-accent);
}
```

## Search Indexing

### Browser Mode

Uses IndexedDB text search:

```typescript
// Simple text search (case-insensitive by default)
function findMatches(content: string, query: SearchQuery): MatchPosition[] {
  const searchText = query.options.caseSensitive 
    ? content 
    : content.toLowerCase();
  const searchQuery = query.options.caseSensitive 
    ? query.text 
    : query.text.toLowerCase();
  
  if (query.options.regex) {
    return findRegexMatches(content, query.text, query.options);
  }
  
  const matches: MatchPosition[] = [];
  let index = 0;
  
  while (true) {
    const pos = searchText.indexOf(searchQuery, index);
    if (pos === -1) break;
    
    if (!query.options.wholeWord || isWholeWord(content, pos, searchQuery.length)) {
      matches.push({ start: pos, end: pos + searchQuery.length });
    }
    index = pos + 1;
  }
  
  return matches;
}
```

### Remote Mode

Server-side search (if implemented):

```typescript
interface SearchSessionsCommand {
  type: 'search_sessions';
  query: string;
  options: {
    caseSensitive: boolean;
    regex: boolean;
    scope: 'all' | 'project';
  };
}

interface SearchSessionsResponse {
  results: SearchResult[];
  totalCount: number;
  hasMore: boolean;
}
```

## Advanced Filters

### Date Range

```
┌─────────────────────────────────────┐
│ 📅 Date Range                       │
│ ┌─────────────┐ ┌─────────────┐    │
│ │ 2024-01-01  │ │ 2024-01-31  │    │
│ └─────────────┘ └─────────────┘    │
│   From            To                │
│                                     │
│ Quick: [Today] [Week] [Month] [All] │
└─────────────────────────────────────┘
```

### Message Type

```
┌─────────────────────────────────────┐
│ Message Type                        │
│ ┌────┐ User messages               │
│ │ ✓  │                             │
│ └────┘                             │
│ ┌────┐ Assistant messages          │
│ │ ✓  │                             │
│ └────┘                             │
│ ┌────┐ Tool outputs                │
│ │    │                             │
│ └────┘                             │
└─────────────────────────────────────┘
```

### Model Filter

```
┌─────────────────────────────────────┐
│ Model                               │
│ ┌──────────────────────────────────┐│
│ │ All models                     ▾ ││
│ └──────────────────────────────────┘│
│ - Claude Sonnet 4                   │
│ - GPT-4o                            │
│ - Gemini Pro                        │
└─────────────────────────────────────┘
```

## Search Results Pagination

For large result sets:

```typescript
interface PaginatedResults {
  results: SearchResult[];
  page: number;
  pageSize: number;
  totalResults: number;
  totalPages: number;
}

async function loadMoreResults(): Promise<void> {
  if (currentPage >= totalPages) return;
  
  const nextPage = await searchAllSessions(query, { page: currentPage + 1 });
  setResults([...results, ...nextPage.results]);
  setCurrentPage(currentPage + 1);
}
```

**Infinite scroll:**
```typescript
function handleScroll(e: UIEvent): void {
  const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
  const nearBottom = scrollHeight - scrollTop - clientHeight < 100;
  
  if (nearBottom && !loading && hasMore) {
    loadMoreResults();
  }
}
```

## Empty and Error States

### No Results

```
┌─────────────────────────────────────┐
│ 🔍 [no-matching-text          ] ×   │
├─────────────────────────────────────┤
│                                     │
│            🔍                       │
│                                     │
│     No results found                │
│                                     │
│     Try different keywords or       │
│     adjust your filters             │
│                                     │
└─────────────────────────────────────┘
```

### Search Error

```
┌─────────────────────────────────────┐
│                                     │
│            ⚠️                       │
│                                     │
│     Search failed                   │
│                                     │
│     Could not complete the search.  │
│     Please try again.               │
│                                     │
│     [Retry]                         │
│                                     │
└─────────────────────────────────────┘
```

## Performance Considerations

### Debouncing

```typescript
const SEARCH_DEBOUNCE_MS = 300;

const debouncedSearch = useMemo(
  () => debounce((query: string) => {
    performSearch(query);
  }, SEARCH_DEBOUNCE_MS),
  []
);
```

### Result Caching

```typescript
const searchCache = new Map<string, SearchResult[]>();

async function search(query: string): Promise<SearchResult[]> {
  const cacheKey = `${query}:${JSON.stringify(options)}`;
  
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey)!;
  }
  
  const results = await performSearch(query);
  searchCache.set(cacheKey, results);
  
  // Limit cache size
  if (searchCache.size > 50) {
    const firstKey = searchCache.keys().next().value;
    searchCache.delete(firstKey);
  }
  
  return results;
}
```

### Virtualized Results

For many results:
```typescript
interface VirtualizedSearchResultsProps {
  results: SearchResult[];
  itemHeight: number;
  containerHeight: number;
}
```

## Accessibility

- **Keyboard navigation**: Full keyboard support for find bar
- **Announcements**: "X matches found", "Match Y of Z"
- **Focus management**: Focus find input on open, restore on close
- **Screen reader**: Results include context and position
- **Skip to match**: Button to jump to current match
