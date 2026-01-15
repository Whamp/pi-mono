# Error Handling

Error categories, recovery strategies, and user feedback patterns.

## Overview

Error handling in Pi Web UI covers:
- Network and connection errors
- API and authentication errors
- Storage and data errors
- User input validation
- Recovery and retry strategies

## Error Categories

### Error Taxonomy

```typescript
type ErrorCategory =
  | 'network'       // Connection, timeout, offline
  | 'auth'          // API keys, tokens, permissions
  | 'rate_limit'    // Too many requests
  | 'context'       // Context overflow, token limits
  | 'validation'    // Invalid input, format errors
  | 'storage'       // IndexedDB, quota, corruption
  | 'server'        // 5xx errors, crashes
  | 'user'          // Cancelled, aborted
  | 'unknown';      // Unclassified errors

interface AppError extends Error {
  category: ErrorCategory;
  code: string;
  userMessage: string;
  retryable: boolean;
  recoverable: boolean;
  details?: Record<string, unknown>;
}
```

### Error Codes

| Category | Code | Description |
|----------|------|-------------|
| network | `NETWORK_OFFLINE` | Device is offline |
| network | `NETWORK_TIMEOUT` | Request timed out |
| network | `NETWORK_REFUSED` | Connection refused |
| network | `NETWORK_LOST` | Connection dropped |
| auth | `AUTH_INVALID_KEY` | Invalid API key format |
| auth | `AUTH_EXPIRED` | Token expired |
| auth | `AUTH_MISSING` | No API key configured |
| auth | `AUTH_DENIED` | Permission denied (403) |
| rate_limit | `RATE_LIMITED` | Too many requests |
| rate_limit | `QUOTA_EXCEEDED` | API quota exceeded |
| context | `CONTEXT_OVERFLOW` | Message too long |
| context | `TOKEN_LIMIT` | Token limit exceeded |
| validation | `INVALID_INPUT` | Invalid user input |
| validation | `INVALID_FORMAT` | Invalid data format |
| storage | `STORAGE_QUOTA` | Storage quota exceeded |
| storage | `STORAGE_CORRUPT` | Data corruption |
| storage | `STORAGE_UNAVAILABLE` | IndexedDB unavailable |
| server | `SERVER_ERROR` | Internal server error (500) |
| server | `SERVER_UNAVAILABLE` | Service unavailable (503) |
| server | `SERVER_TIMEOUT` | Gateway timeout (504) |
| user | `USER_CANCELLED` | User cancelled operation |
| user | `USER_ABORTED` | User aborted streaming |

## Error Classification

```typescript
function classifyError(error: unknown): AppError {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    if (!navigator.onLine) {
      return createError('network', 'NETWORK_OFFLINE', 
        'You appear to be offline. Check your internet connection.');
    }
    return createError('network', 'NETWORK_REFUSED',
      'Could not connect to the server.');
  }
  
  // Abort errors
  if (error instanceof DOMException && error.name === 'AbortError') {
    return createError('user', 'USER_CANCELLED', 
      'Request was cancelled.', { retryable: false });
  }
  
  // HTTP errors
  if (error instanceof Response || (error as any)?.status) {
    return classifyHttpError(error as Response);
  }
  
  // Storage errors
  if (error instanceof DOMException) {
    if (error.name === 'QuotaExceededError') {
      return createError('storage', 'STORAGE_QUOTA',
        'Storage is full. Delete some conversations to continue.');
    }
  }
  
  // Provider-specific errors
  if ((error as any)?.error?.type) {
    return classifyProviderError(error as any);
  }
  
  // Unknown
  return createError('unknown', 'UNKNOWN_ERROR',
    'An unexpected error occurred.');
}

function classifyHttpError(response: Response): AppError {
  switch (response.status) {
    case 400:
      return createError('validation', 'INVALID_INPUT',
        'Invalid request. Please try again.');
    case 401:
      return createError('auth', 'AUTH_INVALID_KEY',
        'Invalid API key. Please check your settings.');
    case 403:
      return createError('auth', 'AUTH_DENIED',
        'Access denied. Check your API key permissions.');
    case 429:
      const retryAfter = parseInt(response.headers.get('Retry-After') ?? '60');
      return createError('rate_limit', 'RATE_LIMITED',
        `Too many requests. Please wait ${retryAfter} seconds.`,
        { retryAfter, retryable: true });
    case 500:
      return createError('server', 'SERVER_ERROR',
        'Server error. Please try again.', { retryable: true });
    case 502:
    case 503:
      return createError('server', 'SERVER_UNAVAILABLE',
        'Service temporarily unavailable.', { retryable: true });
    case 504:
      return createError('server', 'SERVER_TIMEOUT',
        'Request timed out.', { retryable: true });
    default:
      return createError('unknown', 'HTTP_ERROR',
        `Request failed (${response.status}).`);
  }
}

function classifyProviderError(error: { error: { type: string; message: string } }): AppError {
  const { type, message } = error.error;
  
  switch (type) {
    case 'invalid_api_key':
      return createError('auth', 'AUTH_INVALID_KEY',
        'Invalid API key. Please check your settings.');
    case 'rate_limit_error':
      return createError('rate_limit', 'RATE_LIMITED',
        message, { retryable: true });
    case 'context_length_exceeded':
    case 'max_tokens_exceeded':
      return createError('context', 'CONTEXT_OVERFLOW',
        'Conversation is too long. Try compacting the context.');
    case 'overloaded_error':
      return createError('server', 'SERVER_UNAVAILABLE',
        'Service is overloaded. Please try again.', { retryable: true });
    default:
      return createError('unknown', 'PROVIDER_ERROR', message);
  }
}

function createError(
  category: ErrorCategory,
  code: string,
  userMessage: string,
  options: Partial<AppError> = {}
): AppError {
  return {
    name: 'AppError',
    message: userMessage,
    category,
    code,
    userMessage,
    retryable: options.retryable ?? false,
    recoverable: options.recoverable ?? true,
    ...options,
  };
}
```

## Error Recovery Strategies

### Automatic Retry

```typescript
interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    'NETWORK_TIMEOUT',
    'NETWORK_REFUSED',
    'SERVER_ERROR',
    'SERVER_UNAVAILABLE',
    'SERVER_TIMEOUT',
    'RATE_LIMITED',
  ],
};

async function withAutoRetry<T>(
  operation: () => Promise<T>,
  config = defaultRetryConfig
): Promise<T> {
  let lastError: AppError;
  let delay = config.initialDelay;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = classifyError(error);
      
      // Check if retryable
      if (!config.retryableErrors.includes(lastError.code)) {
        throw lastError;
      }
      
      // Check if max retries reached
      if (attempt === config.maxRetries) {
        throw lastError;
      }
      
      // Handle rate limit with specific delay
      if (lastError.details?.retryAfter) {
        delay = (lastError.details.retryAfter as number) * 1000;
      }
      
      // Emit retry event
      emit('retry', { attempt: attempt + 1, delay, error: lastError });
      
      // Wait before retry
      await sleep(delay);
      
      // Increase delay for next attempt
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
    }
  }
  
  throw lastError!;
}
```

### Context Overflow Recovery

```typescript
async function handleContextOverflow(): Promise<void> {
  const state = sessionStore.getState();
  
  // Show compaction notification
  toast.info('Context too long. Compacting...');
  sessionStore.setState({ isCompacting: true });
  
  try {
    if (state.mode === 'browser') {
      await browserAdapter.compact();
    } else {
      await wsManager.send({ type: 'compact' });
    }
    
    toast.success('Context compacted');
    
    // Retry the original operation
    emit('retry_after_compact');
  } catch (error) {
    toast.error('Failed to compact context');
    throw error;
  } finally {
    sessionStore.setState({ isCompacting: false });
  }
}
```

### Connection Recovery

```typescript
async function recoverConnection(): Promise<void> {
  const state = sessionStore.getState();
  
  if (state.mode !== 'remote') return;
  
  sessionStore.setState({ connectionStatus: 'reconnecting' });
  
  try {
    // Reconnect WebSocket
    await wsManager.connect();
    
    // Sync state from server
    await syncRemoteState();
    
    sessionStore.setState({ connectionStatus: 'connected' });
    toast.success('Reconnected');
  } catch (error) {
    sessionStore.setState({ connectionStatus: 'error' });
    
    // Offer manual retry
    showBanner({
      type: 'error',
      message: 'Could not reconnect to server.',
      action: { label: 'Retry', onClick: recoverConnection },
    });
  }
}
```

## User Feedback

### Error Display Patterns

| Error Type | Display Method | User Action |
|------------|---------------|-------------|
| Network offline | Banner (persistent) | Wait or check connection |
| Auth error | Toast + dialog | Enter valid API key |
| Rate limit | Toast with countdown | Wait or upgrade plan |
| Context overflow | Toast + auto-compact | Manual compact option |
| Validation error | Inline error | Fix input |
| Server error | Toast | Retry |
| Unknown | Toast | Report issue |

### Toast Notifications

```typescript
function showErrorToast(error: AppError): void {
  const options: ToastOptions = {
    type: 'error',
    message: error.userMessage,
    duration: error.retryable ? 5000 : 0,  // Persistent if not retryable
  };
  
  if (error.retryable) {
    options.action = {
      label: 'Retry',
      onClick: () => emit('retry_request'),
    };
  }
  
  if (error.code === 'AUTH_INVALID_KEY' || error.code === 'AUTH_MISSING') {
    options.action = {
      label: 'Add Key',
      onClick: () => openDialog('api-key'),
    };
  }
  
  toast.show(options);
}
```

### Banner Notifications

```typescript
function showErrorBanner(error: AppError): void {
  // Offline banner
  if (error.code === 'NETWORK_OFFLINE') {
    showBanner({
      type: 'warning',
      message: 'You\'re offline. Changes will sync when connection is restored.',
      persistent: true,
    });
    return;
  }
  
  // Reconnecting banner
  if (error.code === 'NETWORK_LOST') {
    showBanner({
      type: 'warning',
      message: 'Connection lost. Reconnecting...',
      persistent: true,
      action: { label: 'Retry Now', onClick: recoverConnection },
    });
    return;
  }
  
  // Rate limit banner
  if (error.code === 'RATE_LIMITED' && error.details?.retryAfter) {
    const seconds = error.details.retryAfter as number;
    showBanner({
      type: 'warning',
      message: `Rate limited. Waiting ${seconds}s...`,
      persistent: true,
      action: { label: 'Cancel', onClick: cancelRetry },
    });
    startCountdown(seconds);
  }
}
```

### Inline Errors

```typescript
interface InlineErrorProps {
  error: string;
  field?: string;
}

function InlineError({ error, field }: InlineErrorProps) {
  return (
    <div className="inline-error" role="alert">
      <span className="error-icon">⚠️</span>
      <span className="error-message">{error}</span>
    </div>
  );
}

// Usage in form
<input
  value={apiKey}
  onChange={handleChange}
  aria-invalid={!!error}
  aria-describedby={error ? 'api-key-error' : undefined}
/>
{error && <InlineError id="api-key-error" error={error} />}
```

## Validation

### Input Validation

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  field: string;
  message: string;
  code: string;
}

function validateApiKey(provider: string, key: string): ValidationResult {
  const errors: ValidationError[] = [];
  
  if (!key) {
    errors.push({
      field: 'key',
      message: 'API key is required',
      code: 'REQUIRED',
    });
    return { valid: false, errors };
  }
  
  // Provider-specific validation
  switch (provider) {
    case 'anthropic':
      if (!key.startsWith('sk-ant-')) {
        errors.push({
          field: 'key',
          message: 'Anthropic API keys start with "sk-ant-"',
          code: 'INVALID_FORMAT',
        });
      }
      break;
    case 'openai':
      if (!key.startsWith('sk-')) {
        errors.push({
          field: 'key',
          message: 'OpenAI API keys start with "sk-"',
          code: 'INVALID_FORMAT',
        });
      }
      break;
  }
  
  return { valid: errors.length === 0, errors };
}

function validateConnectionProfile(profile: ConnectionProfile): ValidationResult {
  const errors: ValidationError[] = [];
  
  if (!profile.name?.trim()) {
    errors.push({ field: 'name', message: 'Name is required', code: 'REQUIRED' });
  }
  
  if (!profile.url?.trim()) {
    errors.push({ field: 'url', message: 'URL is required', code: 'REQUIRED' });
  } else if (!isValidWebSocketUrl(profile.url)) {
    errors.push({ field: 'url', message: 'Invalid WebSocket URL', code: 'INVALID_FORMAT' });
  }
  
  if (!profile.token?.trim()) {
    errors.push({ field: 'token', message: 'Token is required', code: 'REQUIRED' });
  }
  
  return { valid: errors.length === 0, errors };
}
```

### Form Error Handling

```typescript
function useFormValidation<T>(
  initialValues: T,
  validate: (values: T) => ValidationResult
) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  
  function handleChange(field: keyof T, value: unknown): void {
    setValues(prev => ({ ...prev, [field]: value }));
    
    // Clear error on change
    if (errors[field as string]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field as string];
        return next;
      });
    }
  }
  
  function handleBlur(field: keyof T): void {
    setTouched(prev => ({ ...prev, [field]: true }));
    
    // Validate on blur
    const result = validate(values);
    const fieldError = result.errors.find(e => e.field === field);
    if (fieldError) {
      setErrors(prev => ({ ...prev, [field as string]: fieldError.message }));
    }
  }
  
  function handleSubmit(onSubmit: (values: T) => Promise<void>): (e: FormEvent) => void {
    return async (e) => {
      e.preventDefault();
      
      // Touch all fields
      setTouched(Object.keys(values).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
      
      // Validate
      const result = validate(values);
      if (!result.valid) {
        const errorMap = result.errors.reduce(
          (acc, err) => ({ ...acc, [err.field]: err.message }),
          {}
        );
        setErrors(errorMap);
        return;
      }
      
      await onSubmit(values);
    };
  }
  
  return { values, errors, touched, handleChange, handleBlur, handleSubmit };
}
```

## Error Logging

### Error Reporting

```typescript
interface ErrorReport {
  error: AppError;
  context: {
    mode: 'browser' | 'remote';
    sessionId: string | null;
    url: string;
    userAgent: string;
    timestamp: string;
  };
  stack?: string;
}

function reportError(error: unknown): void {
  const appError = classifyError(error);
  
  // Don't report user-initiated errors
  if (appError.category === 'user') return;
  
  const report: ErrorReport = {
    error: appError,
    context: {
      mode: sessionStore.getState().mode,
      sessionId: sessionStore.getState().sessionId,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    },
    stack: error instanceof Error ? error.stack : undefined,
  };
  
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('[Error Report]', report);
  }
  
  // Could send to error tracking service
  // sendToErrorService(report);
}
```

### Global Error Handler

```typescript
function setupGlobalErrorHandlers(): void {
  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
    const error = classifyError(event.reason);
    handleGlobalError(error);
  });
  
  // Uncaught errors
  window.addEventListener('error', (event) => {
    const error = classifyError(event.error);
    handleGlobalError(error);
  });
}

function handleGlobalError(error: AppError): void {
  reportError(error);
  
  // Show user-friendly message
  if (error.recoverable) {
    showErrorToast(error);
  } else {
    showFatalErrorDialog(error);
  }
}
```

## Accessibility

### Error Announcements

```typescript
function announceError(error: AppError): void {
  // Use ARIA live region for immediate announcement
  const priority = error.category === 'auth' || error.category === 'network'
    ? 'assertive'
    : 'polite';
  
  announce(error.userMessage, priority);
}
```

### Focus Management

```typescript
function focusOnError(fieldId: string): void {
  const field = document.getElementById(fieldId);
  if (field) {
    field.focus();
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// After form validation
if (!result.valid) {
  const firstError = result.errors[0];
  focusOnError(firstError.field);
}
```

### Screen Reader Support

```html
<!-- Error summary for forms -->
<div role="alert" aria-live="assertive" id="form-errors">
  <h3>Please fix the following errors:</h3>
  <ul>
    <li><a href="#name">Name is required</a></li>
    <li><a href="#url">Invalid URL format</a></li>
  </ul>
</div>

<!-- Inline error -->
<input 
  id="name"
  aria-invalid="true"
  aria-describedby="name-error"
/>
<span id="name-error" role="alert">Name is required</span>
```
