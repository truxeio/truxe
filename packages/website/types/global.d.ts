declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: { props?: Record<string, unknown> },
    ) => void;
  }
}

export {};
