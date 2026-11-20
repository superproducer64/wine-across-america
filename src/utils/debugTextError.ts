// TEMPORARY dev-only diagnostic. Remove once the stray-text bug is found.
// Captures React's owner stack when RN logs "Text strings must be rendered
// within a <Text>" so the LogBox names the component that rendered it.
import * as React from 'react';

if (__DEV__) {
  const orig = console.error;
  let busy = false;
  console.error = (...args: unknown[]) => {
    orig(...args);
    if (busy) return;
    let text = '';
    try { text = args.map(a => (typeof a === 'string' ? a : String((a as any)?.message ?? a))).join(' '); } catch {}
    if (text.includes('Text strings must be rendered')) {
      busy = true;
      try {
        const cap = (React as any).captureOwnerStack;
        const owner = typeof cap === 'function' ? cap() : null;
        console.warn('[TEXT-BUG owner stack]\n' + (owner ? String(owner).slice(0, 1500) : '(none; captureOwnerStack ' + typeof cap + ')'));
      } finally {
        busy = false;
      }
    }
  };
  setTimeout(() => console.warn('[debug hook loaded] text-error diagnostic active'), 1500);
}
