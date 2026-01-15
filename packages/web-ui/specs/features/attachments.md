# Attachments

File uploads, image handling, and drag-and-drop support for including files in messages.

## Overview

Attachments allow users to include files in their messages for the AI to analyze. The system handles:
- Image uploads and preview generation
- Document extraction (PDF, Office, text)
- File validation and size limits
- Drag-and-drop and paste support

## Supported File Types

### Images

| Format | Support | Max Size | Notes |
|--------|---------|----------|-------|
| JPEG | ✅ | 10 MB | Auto-resized if too large |
| PNG | ✅ | 10 MB | Auto-resized if too large |
| GIF | ✅ | 10 MB | First frame only for preview |
| WebP | ✅ | 10 MB | Auto-resized if too large |
| HEIC | ⚠️ | 10 MB | Converted to JPEG |
| SVG | ❌ | - | Use text content instead |

### Documents

| Format | Support | Max Size | Notes |
|--------|---------|----------|-------|
| PDF | ✅ | 50 MB | Text extracted, images optional |
| DOCX | ✅ | 25 MB | Text extracted |
| XLSX | ✅ | 25 MB | Converted to CSV/text |
| PPTX | ✅ | 50 MB | Text and images extracted |
| TXT | ✅ | 5 MB | Direct content |
| MD | ✅ | 5 MB | Direct content |
| CSV | ✅ | 10 MB | Direct content |

### Code Files

| Format | Support | Max Size |
|--------|---------|----------|
| JS/TS | ✅ | 2 MB |
| PY | ✅ | 2 MB |
| JSON | ✅ | 5 MB |
| HTML/CSS | ✅ | 2 MB |
| Any text | ✅ | 2 MB |

## Data Types

```typescript
interface Attachment {
  id: string;                     // Unique identifier
  file: File;                     // Original file
  name: string;                   // Display name
  type: AttachmentType;           // Category
  mimeType: string;               // MIME type
  size: number;                   // Bytes
  status: AttachmentStatus;
  preview?: AttachmentPreview;
  content?: AttachmentContent;
  error?: string;
}

type AttachmentType = 'image' | 'document' | 'code' | 'other';

type AttachmentStatus = 
  | 'pending'      // Queued for processing
  | 'processing'   // Being processed
  | 'ready'        // Ready to send
  | 'uploading'    // Sending to server (remote mode)
  | 'error';       // Failed

interface AttachmentPreview {
  type: 'image' | 'icon';
  url?: string;           // Data URL for image preview
  icon?: string;          // Icon for non-image files
  dimensions?: {
    width: number;
    height: number;
  };
}

interface AttachmentContent {
  type: 'base64' | 'text' | 'extracted';
  data: string;
  extractedText?: string;   // For documents
}
```

## Upload Methods

### File Picker

```typescript
interface FilePickerProps {
  accept: string[];           // MIME types
  multiple: boolean;
  maxFiles: number;
  onSelect: (files: File[]) => void;
}

function openFilePicker(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = SUPPORTED_MIME_TYPES.join(',');
  input.multiple = true;
  input.onchange = (e) => {
    const files = Array.from(input.files ?? []);
    processFiles(files);
  };
  input.click();
}
```

### Drag and Drop

```typescript
interface DropZoneProps {
  onDrop: (files: File[]) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  active: boolean;
}
```

**Visual feedback:**
```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  ╔════════════════════════════════════════════════════╗   │
│  ║                                                    ║   │
│  ║              📎 Drop files here                    ║   │
│  ║                                                    ║   │
│  ║     Images, PDFs, and documents supported         ║   │
│  ║                                                    ║   │
│  ╚════════════════════════════════════════════════════╝   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Implementation:**
```typescript
function handleDragOver(e: DragEvent): void {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
}

function handleDrop(e: DragEvent): void {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files);
  const validFiles = files.filter(isValidFile);
  processFiles(validFiles);
}
```

### Clipboard Paste

```typescript
function handlePaste(e: ClipboardEvent): void {
  const items = e.clipboardData?.items;
  if (!items) return;
  
  const files: File[] = [];
  
  for (const item of items) {
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file && isValidFile(file)) {
        files.push(file);
      }
    }
  }
  
  if (files.length > 0) {
    e.preventDefault();
    processFiles(files);
  }
}
```

**Supported paste sources:**
- Screenshots (Cmd+Shift+4 on Mac, Win+Shift+S on Windows)
- Copied images from browser
- Copied files from file manager

## File Processing Pipeline

```
File Selected
      │
      ▼
┌─────────────┐     fail     ┌─────────────┐
│ Validate    │ ───────────▶ │ Show Error  │
└─────────────┘              └─────────────┘
      │ pass
      ▼
┌─────────────┐
│ Generate    │
│ Preview     │
└─────────────┘
      │
      ▼
┌─────────────┐
│ Extract     │ (for documents)
│ Content     │
└─────────────┘
      │
      ▼
┌─────────────┐
│ Ready       │
└─────────────┘
```

### Validation

```typescript
interface ValidationResult {
  valid: boolean;
  error?: string;
}

function validateFile(file: File): ValidationResult {
  // Check file type
  if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: `Unsupported file type: ${file.type}` };
  }
  
  // Check file size
  const maxSize = getMaxSizeForType(file.type);
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: `File too large: ${formatBytes(file.size)} (max ${formatBytes(maxSize)})` 
    };
  }
  
  return { valid: true };
}
```

### Image Processing

```typescript
async function processImage(file: File): Promise<Attachment> {
  const id = generateId();
  
  // Read file
  const arrayBuffer = await file.arrayBuffer();
  
  // Get dimensions
  const dimensions = await getImageDimensions(file);
  
  // Resize if needed
  const MAX_DIMENSION = 2048;
  let processedData: ArrayBuffer = arrayBuffer;
  let finalDimensions = dimensions;
  
  if (dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION) {
    const result = await resizeImage(file, MAX_DIMENSION);
    processedData = result.data;
    finalDimensions = result.dimensions;
  }
  
  // Generate thumbnail for preview
  const thumbnailUrl = await generateThumbnail(file, 200);
  
  // Convert to base64
  const base64 = arrayBufferToBase64(processedData);
  
  return {
    id,
    file,
    name: file.name,
    type: 'image',
    mimeType: file.type,
    size: processedData.byteLength,
    status: 'ready',
    preview: {
      type: 'image',
      url: thumbnailUrl,
      dimensions: finalDimensions,
    },
    content: {
      type: 'base64',
      data: base64,
    },
  };
}

async function resizeImage(file: File, maxDimension: number): Promise<{
  data: ArrayBuffer;
  dimensions: { width: number; height: number };
}> {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  
  const scale = Math.min(
    maxDimension / img.width,
    maxDimension / img.height,
    1  // Don't upscale
  );
  
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9);
  });
  
  return {
    data: await blob.arrayBuffer(),
    dimensions: { width: canvas.width, height: canvas.height },
  };
}
```

### Document Processing

```typescript
async function processDocument(file: File): Promise<Attachment> {
  const id = generateId();
  
  // Extract text based on type
  let extractedText: string;
  
  switch (file.type) {
    case 'application/pdf':
      extractedText = await extractPdfText(file);
      break;
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      extractedText = await extractDocxText(file);
      break;
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      extractedText = await extractXlsxText(file);
      break;
    default:
      extractedText = await file.text();
  }
  
  return {
    id,
    file,
    name: file.name,
    type: 'document',
    mimeType: file.type,
    size: file.size,
    status: 'ready',
    preview: {
      type: 'icon',
      icon: getIconForMimeType(file.type),
    },
    content: {
      type: 'extracted',
      data: extractedText,
      extractedText,
    },
  };
}
```

## Attachment Previews

### Preview Display

```
┌────────────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 📷   [×] │  │ 📄   [×] │  │ 📊   [×] │  │ 💻   [×] │   │
│  │ preview  │  │ doc.pdf  │  │ data.csv │  │ app.ts   │   │
│  │ img.png  │  │  124 KB  │  │   45 KB  │  │   12 KB  │   │
│  │ 1.2 MB   │  │ 15 pages │  │ 500 rows │  │ 350 lines│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└────────────────────────────────────────────────────────────┘
```

### Preview Component

```typescript
interface AttachmentPreviewProps {
  attachment: Attachment;
  onRemove: () => void;
  onClick?: () => void;  // Opens preview modal
}
```

**Layout:**
```
┌────────────────────┐
│ [thumbnail]    [×] │  ← Remove button
│ filename.ext       │
│ 1.2 MB             │
│ [progress bar]     │  ← During processing/upload
└────────────────────┘
```

### Preview States

**Pending:**
```
┌──────────┐
│ ◌◌◌      │
│ file.pdf │
│ Pending  │
└──────────┘
```

**Processing:**
```
┌──────────┐
│ ●●●      │
│ file.pdf │
│ ████░░░░ │
└──────────┘
```

**Ready:**
```
┌──────────┐
│ 📄       │
│ file.pdf │
│ 124 KB   │
└──────────┘
```

**Error:**
```
┌──────────┐
│ ⚠️   [×] │
│ file.pdf │
│ Too large│
└──────────┘
```

## Message Integration

### Sending with Attachments

```typescript
interface MessageWithAttachments {
  content: string;
  attachments: Attachment[];
}

async function sendMessage(message: MessageWithAttachments): Promise<void> {
  const content: ContentBlock[] = [];
  
  // Add text
  if (message.content) {
    content.push({ type: 'text', text: message.content });
  }
  
  // Add attachments
  for (const attachment of message.attachments) {
    if (attachment.type === 'image') {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          mediaType: attachment.mimeType,
          data: attachment.content!.data,
        },
      });
    } else {
      // Documents sent as text
      content.push({
        type: 'text',
        text: `--- Content of ${attachment.name} ---\n${attachment.content!.data}`,
      });
    }
  }
  
  await adapter.prompt(content);
}
```

### Attachment Display in Messages

```
┌─────────────────────────────────────────────────────────────┐
│                                               User Message   │
│                                                             │
│  Can you analyze this screenshot and fix the bug?          │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐│
│  │ [Screenshot image preview - clickable to enlarge]      ││
│  │                                                        ││
│  │ error-screenshot.png · 1.2 MB · 1920×1080              ││
│  └────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌──────────┐                                              │
│  │ 📄       │  debug-log.txt · 45 KB                       │
│  └──────────┘                                              │
│                                                             │
│                                              12:34 PM       │
└─────────────────────────────────────────────────────────────┘
```

## Image Lightbox

Clicking an image attachment opens a lightbox:

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                   [×]  │
│                                                                        │
│                                                                        │
│                    ┌────────────────────────────────┐                  │
│                    │                                │                  │
│                    │      [Full size image]         │                  │
│                    │                                │                  │
│                    │                                │                  │
│                    └────────────────────────────────┘                  │
│                                                                        │
│                                                                        │
│ error-screenshot.png · 1920×1080 · 1.2 MB      [⬇️ Download] [📋 Copy] │
└────────────────────────────────────────────────────────────────────────┘
```

**Interactions:**
- Click outside or × to close
- Escape to close
- Pinch to zoom (mobile)
- Scroll to zoom (desktop)
- Drag to pan

## Limits and Quotas

### Per-Message Limits

| Limit | Value |
|-------|-------|
| Max attachments per message | 10 |
| Max total size per message | 100 MB |
| Max images per message | 10 |
| Max documents per message | 5 |

### Provider-Specific Limits

| Provider | Max Images | Image Size Limit |
|----------|------------|------------------|
| Anthropic | 20 | 5 MB each |
| OpenAI | 10 | 20 MB each |
| Google | 16 | 20 MB each |

### Enforcement

```typescript
function canAddAttachment(
  existing: Attachment[],
  newFile: File
): { allowed: boolean; reason?: string } {
  // Check count
  if (existing.length >= MAX_ATTACHMENTS) {
    return { allowed: false, reason: `Maximum ${MAX_ATTACHMENTS} attachments per message` };
  }
  
  // Check total size
  const currentSize = existing.reduce((sum, a) => sum + a.size, 0);
  if (currentSize + newFile.size > MAX_TOTAL_SIZE) {
    return { allowed: false, reason: `Total size would exceed ${formatBytes(MAX_TOTAL_SIZE)}` };
  }
  
  // Check type-specific limits
  const imageCount = existing.filter(a => a.type === 'image').length;
  if (isImage(newFile) && imageCount >= MAX_IMAGES) {
    return { allowed: false, reason: `Maximum ${MAX_IMAGES} images per message` };
  }
  
  return { allowed: true };
}
```

## Mobile Considerations

### Touch Interactions

| Gesture | Action |
|---------|--------|
| Tap preview | Open full view |
| Long press | Show context menu |
| Swipe left | Remove |
| Pinch (lightbox) | Zoom |

### Camera Access

```typescript
interface CameraButtonProps {
  onCapture: (file: File) => void;
}

function openCamera(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = 'environment';  // Use back camera
  input.onchange = handleCapture;
  input.click();
}
```

### Gallery Access

```typescript
function openGallery(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/*';
  input.multiple = true;
  input.onchange = handleSelect;
  input.click();
}
```

## Remote Mode Handling

In remote mode, attachments are sent to the server:

```typescript
async function uploadAttachment(attachment: Attachment): Promise<string> {
  // Convert to base64 for transmission
  const payload = {
    name: attachment.name,
    mimeType: attachment.mimeType,
    content: attachment.content!.data,
  };
  
  const response = await adapter.sendCommand({
    type: 'upload_attachment',
    ...payload,
  });
  
  return response.data.attachmentId;
}
```

## Error Handling

| Error | User Feedback |
|-------|---------------|
| File too large | "File exceeds maximum size of X MB" |
| Unsupported type | "File type not supported. Supported: images, PDF, Office, text" |
| Processing failed | "Failed to process file. Try a different format." |
| Upload failed | "Upload failed. Check connection and retry." |
| Quota exceeded | "Too many attachments. Remove some and try again." |

## Accessibility

- **Labels**: All buttons and previews have aria-labels
- **Alt text**: Images include file name as alt text
- **Keyboard**: Tab through previews, Enter to view, Delete to remove
- **Screen reader**: Announce attachment added/removed
- **Focus**: Return focus after modal close
