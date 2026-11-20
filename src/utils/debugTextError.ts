// TEMPORARY dev-only diagnostic. Remove once the stray-text bug is found.
// React 19 exposes the owner stack while a render is in progress; capture it
// when RN logs "Text strings must be rendered within a <Text>" so the LogBox
// names the component that rendered the bare string.
import * as React from 'react';

if (__DEV__) {
  const orig = console.error;
  let busy = false;
  console.error = (...args: unknown[]) => {
    orig(...args);
    if (busy) return;
    const first = typeof args[0] === 'string' ? args[0] : '';
    if (first.includes('Text strings must be rendered within a <Text>')) {
      busy = true;
      try {
        const owner = (React as any).captureOwnerStack?.() ?? '(no owner stack)';
        console.warn('[TEXT-BUG owner stack]\n' + String(owner).slice(0, 1500));
      } finally {
        busy = false;
      }
    }
  };
}
