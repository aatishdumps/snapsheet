/**
 * index.ts — the state-layer public API barrel (D-05).
 *
 * The single import surface for the `/state` layer: the Zustand stores, the
 * runtime bitmap cache, and the document-model contract types.
 *
 * SCOPE: explicit named re-exports only — no runtime logic. Named exports only.
 */

// Zustand stores — the document model (D-05).
export { useDocumentStore } from './documentStore';
export { useLayoutStore } from './layoutStore';
export { useUiStore } from './uiStore';
export { useActiveProjectStore } from './activeProjectStore';

// Runtime decoded-ImageBitmap cache (non-persisted).
export { putBitmap, getBitmap, deleteBitmap } from './bitmapCache';

// State-layer store interfaces.
export type { DocumentState } from './documentStore';
export type { LayoutState } from './layoutStore';
export type { UiState } from './uiStore';
export type { ActiveProjectState } from './activeProjectStore';

// Serializable document-model contract types (D-01, D-05).
export type {
  PhotoEntry,
  DocumentData,
  LayoutData,
  SerializedProject,
} from './types';

// Document-model constants for store initialization.
export { SCHEMA_VERSION, EMPTY_DOCUMENT, EMPTY_LAYOUT } from './types';
