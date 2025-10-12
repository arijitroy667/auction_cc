declare global {
  interface Window {
    Buffer: typeof Buffer;
    process: any;
    ethereum?: any;
  }
}

export {};