/// <reference types="vite/client" />

declare module '*.svg' {
  const src: string;
  export default src;
}
/// <reference types="react" />
/// <reference types="react-dom" />

/** Build-time constant injected by Vite — changes every build. */
declare const __BUILD_ID__: string;

import type { ReactElement, ReactNode } from 'react';

declare global {
  namespace JSX {
    interface Element extends ReactElement<any, any> {}
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}
