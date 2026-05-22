/**
 * import — file decode, EXIF normalization, downscale, batch import pipeline.
 *
 * Pure, UI-decoupled image-import engine. The public surface is the contract
 * types plus `importFiles`, the batch orchestrator. The internal stages
 * (`sniff`, `orientation`, `decode`, `downscale`) are deliberately not barrelled
 * — they run inside the worker and are not part of the consumer-facing API.
 */
export * from './types';
export * from './pipeline';
