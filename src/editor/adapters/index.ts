/**
 * adapters — thin DOM import adapters (file picker, drag-and-drop, camera).
 *
 * Each adapter listens for one DOM event source and produces `File[]` only —
 * NO decode logic (D-07). The decode/normalize pipeline never knows which
 * adapter a file came from. DOM is allowed here; React/Konva/ui are not.
 */
export * from './filePicker';
export * from './dropZone';
export * from './cameraCapture';
