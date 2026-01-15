// Main chat interface

export type { Agent, AgentMessage, AgentState, ThinkingLevel } from "@mariozechner/pi-agent-core";
export type { Model } from "@mariozechner/pi-ai";
// Adapters
export { RemoteSessionAdapter } from "./adapters/RemoteSessionAdapter.js";
export { ChatPanel } from "./ChatPanel.js";
// Components
export { AgentInterface, type MessageMatch } from "./components/AgentInterface.js";
export { AppLayout } from "./components/AppLayout.js";
export { AttachmentTile } from "./components/AttachmentTile.js";
export { Banner, type BannerOptions, type BannerVariant } from "./components/Banner.js";
export { BottomSheet } from "./components/BottomSheet.js";
export { ConnectionStatus } from "./components/ConnectionStatus.js";
export { ConsoleBlock } from "./components/ConsoleBlock.js";
export { ContextWarning } from "./components/ContextWarning.js";
export { ErrorBanner, type ErrorType } from "./components/ErrorBanner.js";
export { ExpandableSection } from "./components/ExpandableSection.js";
export { FindBar, type FindBarOptions, type FindBarProps } from "./components/FindBar.js";
export { type ForkBranch, ForkIndicator, SwitchBranchEvent } from "./components/ForkIndicator.js";
export { Header } from "./components/Header.js";
export { Input } from "./components/Input.js";
export { MessageEditor } from "./components/MessageEditor.js";
export { MessageList } from "./components/MessageList.js";
// Message components
export type { ArtifactMessage, UserMessageWithAttachments } from "./components/Messages.js";
export {
	AssistantMessage,
	convertAttachments,
	defaultConvertToLlm,
	isArtifactMessage,
	isUserMessageWithAttachments,
	ToolMessage,
	UserMessage,
} from "./components/Messages.js";
// Message renderer registry
export {
	getMessageRenderer,
	type MessageRenderer,
	type MessageRole,
	registerMessageRenderer,
	renderMessage,
} from "./components/message-renderer-registry.js";
export { OfflineIndicator } from "./components/OfflineIndicator.js";
export {
	type SandboxFile,
	SandboxIframe,
	type SandboxResult,
	type SandboxUrlProvider,
} from "./components/SandboxedIframe.js";
export {
	type DateRangeFilter,
	SearchFilters,
	type SearchFiltersProps,
	type SearchFiltersState,
} from "./components/SearchFilters.js";
export { SessionItem } from "./components/SessionItem.js";
export { type SessionMetadata as SidebarSessionMetadata, type SessionUsage, Sidebar } from "./components/Sidebar.js";
export { StorageQuota } from "./components/StorageQuota.js";
export { StreamingMessageContainer } from "./components/StreamingMessageContainer.js";
// Sandbox Runtime Providers
export { ArtifactsRuntimeProvider } from "./components/sandbox/ArtifactsRuntimeProvider.js";
export { AttachmentsRuntimeProvider } from "./components/sandbox/AttachmentsRuntimeProvider.js";
export { type ConsoleLog, ConsoleRuntimeProvider } from "./components/sandbox/ConsoleRuntimeProvider.js";
export {
	type DownloadableFile,
	FileDownloadRuntimeProvider,
} from "./components/sandbox/FileDownloadRuntimeProvider.js";
export { RuntimeMessageBridge } from "./components/sandbox/RuntimeMessageBridge.js";
export { RUNTIME_MESSAGE_ROUTER } from "./components/sandbox/RuntimeMessageRouter.js";
export type { SandboxRuntimeProvider } from "./components/sandbox/SandboxRuntimeProvider.js";
export { ThinkingBlock } from "./components/ThinkingBlock.js";
export { Toast, type ToastVariant } from "./components/Toast.js";
export { ApiKeyPromptDialog } from "./dialogs/ApiKeyPromptDialog.js";
export { AttachmentOverlay } from "./dialogs/AttachmentOverlay.js";
// Dialogs
export { CompactionDialog } from "./dialogs/CompactionDialog.js";
export { ConnectionsDialog } from "./dialogs/ConnectionsDialog.js";
export { ModelSelector } from "./dialogs/ModelSelector.js";
export { PersistentStorageDialog } from "./dialogs/PersistentStorageDialog.js";
export { ProvidersModelsTab } from "./dialogs/ProvidersModelsTab.js";
export { type RemoteSession, RemoteSessionsDialog } from "./dialogs/RemoteSessionsDialog.js";
export { SessionInfoDialog, type SessionInfoDialogProps } from "./dialogs/SessionInfoDialog.js";
export { SessionListDialog } from "./dialogs/SessionListDialog.js";
export { ApiKeysTab, PreferencesTab, ProxyTab, SettingsDialog, SettingsTab } from "./dialogs/SettingsDialog.js";
export { ShortcutsHelpDialog } from "./dialogs/ShortcutsHelpDialog.js";
// Networking
export type {
	ConnectionOptions,
	ConnectionProfile,
	ConnectionState,
	ReconnectionConfig,
} from "./networking/connection-types.js";
export {
	type PendingRequest,
	RequestError,
	RequestTimeoutError,
	RPCClient,
} from "./networking/RPCClient.js";
export {
	RPCEventMapper,
	type SessionEvent,
} from "./networking/RPCEventMapper.js";
export type {
	RPCAssistantMessageDeltaEvent,
	RPCBashResult,
	RPCCommand,
	RPCCommandType,
	RPCErrorResponse,
	RPCEvent,
	RPCEventType,
	RPCExtensionUIRequest,
	RPCExtensionUIResponse,
	RPCompactionResult,
	RPCResponse,
	RPCSessionState,
	RPCSessionStats,
	RPCSuccessResponse,
	RPCToolCall,
	RPCToolContentBlock,
	RPCToolResult,
	RPCToolResultDetails,
} from "./networking/rpc-types.js";
export {
	WebSocketClient,
	type WebSocketEvent,
	type WebSocketListener,
} from "./networking/WebSocketClient.js";
// Offline
export type { QueuedMessage } from "./offline/offline-queue.js";
export { OfflineQueue, offlineQueue } from "./offline/offline-queue.js";
export type { SyncEvent } from "./offline/sync-manager.js";
export { SyncManager } from "./offline/sync-manager.js";
// Prompts
export {
	ARTIFACTS_RUNTIME_PROVIDER_DESCRIPTION_RO,
	ARTIFACTS_RUNTIME_PROVIDER_DESCRIPTION_RW,
	ATTACHMENTS_RUNTIME_DESCRIPTION,
} from "./prompts/prompts.js";
// Storage
export { AppStorage, getAppStorage, setAppStorage } from "./storage/app-storage.js";
export { IndexedDBStorageBackend } from "./storage/backends/indexeddb-storage-backend.js";
export type { Migration } from "./storage/migrations.js";
export {
	getCurrentVersion,
	getLatestVersion,
	hasPendingMigrations,
	MIGRATIONS,
	runMigrations,
	setVersion,
} from "./storage/migrations.js";
export { Store } from "./storage/store.js";
export { ConnectionsStore } from "./storage/stores/connections-store.js";
export type {
	AutoDiscoveryProviderType,
	CustomProvider,
	CustomProviderType,
} from "./storage/stores/custom-providers-store.js";
export { CustomProvidersStore } from "./storage/stores/custom-providers-store.js";
export { ProviderKeysStore } from "./storage/stores/provider-keys-store.js";
export type { CachedSession } from "./storage/stores/session-cache-store.js";
export { SessionCacheStore } from "./storage/stores/session-cache-store.js";
export { SessionsStore } from "./storage/stores/sessions-store.js";
export type { ThemePreference } from "./storage/stores/settings-store.js";
export { SettingsStore } from "./storage/stores/settings-store.js";
export type {
	IndexConfig,
	IndexedDBConfig,
	SessionData,
	SessionMetadata,
	StorageBackend,
	StorageTransaction,
	StoreConfig,
} from "./storage/types.js";
// Artifacts
export { ArtifactElement } from "./tools/artifacts/ArtifactElement.js";
export { ArtifactPill } from "./tools/artifacts/ArtifactPill.js";
export { type Artifact, ArtifactsPanel, type ArtifactsParams } from "./tools/artifacts/artifacts.js";
export { ArtifactsToolRenderer } from "./tools/artifacts/artifacts-tool-renderer.js";
export { FullscreenArtifact } from "./tools/artifacts/FullscreenArtifact.js";
export { HtmlArtifact } from "./tools/artifacts/HtmlArtifact.js";
export { ImageArtifact } from "./tools/artifacts/ImageArtifact.js";
export { JsonViewer } from "./tools/artifacts/JsonViewer.js";
export { MarkdownArtifact } from "./tools/artifacts/MarkdownArtifact.js";
export { SvgArtifact } from "./tools/artifacts/SvgArtifact.js";
export { TextArtifact } from "./tools/artifacts/TextArtifact.js";
export { createExtractDocumentTool, extractDocumentTool } from "./tools/extract-document.js";
// Tools
export { getToolRenderer, registerToolRenderer, renderTool, setShowJsonMode } from "./tools/index.js";
export { createJavaScriptReplTool, javascriptReplTool } from "./tools/javascript-repl.js";
export { renderCollapsibleHeader, renderHeader } from "./tools/renderer-registry.js";
export { BashRenderer } from "./tools/renderers/BashRenderer.js";
export { CalculateRenderer } from "./tools/renderers/CalculateRenderer.js";
// Tool renderers
export { DefaultRenderer } from "./tools/renderers/DefaultRenderer.js";
export { GetCurrentTimeRenderer } from "./tools/renderers/GetCurrentTimeRenderer.js";
export type { ToolRenderer, ToolRenderResult } from "./tools/types.js";
export type { Attachment } from "./utils/attachment-utils.js";
// Utils
export { loadAttachment } from "./utils/attachment-utils.js";
export { clearAuthToken, getAuthToken } from "./utils/auth-token.js";
// Auto-connect to local Pi server
export {
	type AutoConnectResult,
	autoConnect,
	checkLocalServer,
	connectToLocalServer,
	type ServerConnection,
} from "./utils/auto-connect.js";
export { dismissAllBanners, dismissBanner, showBanner } from "./utils/banner.js";
export type { ExportData, ImportResult, ProviderKeyData } from "./utils/data-export.js";
export {
	downloadExport,
	exportAllData,
	exportAndDownload,
	importData,
	importFromFile,
	parseExportData,
} from "./utils/data-export.js";
export type { DateGroup, GroupedSessions } from "./utils/date-utils.js";
export { groupSessionsByDate } from "./utils/date-utils.js";
export type { ExportableSession } from "./utils/export-utils.js";
export { exportSessionAsHtml, exportSessionAsJson } from "./utils/export-utils.js";
export { formatCost, formatModelCost, formatTokenCount, formatUsage } from "./utils/format.js";
export type { SwipeHandler, SwipeOptions } from "./utils/gesture-utils.js";
export { createSwipeHandler } from "./utils/gesture-utils.js";
export { i18n, setLanguage, translations } from "./utils/i18n.js";
export type { KeyboardShortcut, ShortcutManager } from "./utils/keyboard-shortcuts.js";
export { createShortcutManager } from "./utils/keyboard-shortcuts.js";
export { applyProxyIfNeeded, createStreamFn, isCorsError, shouldUseProxyForProvider } from "./utils/proxy-utils.js";
export type { HighlightResult, SearchOptions } from "./utils/search-utils.js";
export { countMatches, highlightMatches } from "./utils/search-utils.js";
export type { CleanupOptions, CleanupPreview, CleanupResult } from "./utils/storage-cleanup.js";
export {
	cleanupStorage,
	factoryReset,
	getCleanupPreview,
	getStorageSize,
	getStorageStats,
} from "./utils/storage-cleanup.js";
// Service worker
export {
	activateWaitingServiceWorker,
	clearServiceWorkerCache,
	isServiceWorkerActive,
	registerServiceWorker,
	type ServiceWorkerMessage,
	type ServiceWorkerMessageType,
	type ServiceWorkerResponse,
	sendMessageToServiceWorker,
	unregisterServiceWorker,
} from "./utils/sw-register.js";
export type { ToastOptions } from "./utils/toast.js";
export { dismissAllToasts, showToast } from "./utils/toast.js";
