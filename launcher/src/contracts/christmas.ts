export interface ChristmasControls {
  close(): void;
  isOpen(): boolean;
  nextScene(): void;
  open(): void;
  previousScene(): void;
  subscribe?(listener: () => void): () => void;
}
