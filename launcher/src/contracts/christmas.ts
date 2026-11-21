export interface ChristmasControls {
  close(): void;
  isOpen(): boolean;
  open(): void;
  subscribe?(listener: () => void): () => void;
}
