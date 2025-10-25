// // src/lib/polyfills.ts
// import { Buffer } from 'buffer';

// if (typeof window !== 'undefined') {
//   // Polyfill Buffer for browser
//   window.Buffer = window.Buffer || Buffer;
  
//   // Polyfill process for browser
//   window.process = window.process || {
//     env: {},
//     version: '',
//     browser: true,
//   };
// }

// export {};

// Polyfills for server-side rendering
if (typeof globalThis !== 'undefined') {
  // IndexedDB polyfill for SSR
  if (typeof globalThis.indexedDB === 'undefined') {
    globalThis.indexedDB = {} as IDBFactory;
  }

  // localStorage polyfill for SSR
  if (typeof globalThis.localStorage === 'undefined') {
    globalThis.localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    } as Storage;
  }

  // sessionStorage polyfill for SSR
  if (typeof globalThis.sessionStorage === 'undefined') {
    globalThis.sessionStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    } as Storage;
  }

  // Crypto polyfill for SSR
  if (typeof globalThis.crypto === 'undefined') {
    globalThis.crypto = {
      getRandomValues: (arr: any) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      },
      randomUUID: () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      },
    } as Crypto;
  }
}

export {};