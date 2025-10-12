// src/lib/polyfills.ts
import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
  // Polyfill Buffer for browser
  window.Buffer = window.Buffer || Buffer;
  
  // Polyfill process for browser
  window.process = window.process || {
    env: {},
    version: '',
    browser: true,
  };
}

export {};