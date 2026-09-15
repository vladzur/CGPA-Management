import { afterEach, describe, expect, it } from 'vitest';
import {
  isPrerenderMode,
  publishPrerenderState,
  readInitialState,
  signalPrerenderReady,
} from './prerender';

interface PrerenderWindow {
  __PRERENDER_READY__?: boolean;
  __PRERENDER__?: boolean;
  __PRERENDER_STATE__?: unknown;
  __INITIAL_STATE__?: unknown;
}

function globals(): PrerenderWindow {
  return window as unknown as PrerenderWindow;
}

describe('prerender utilities', () => {
  afterEach(() => {
    delete globals().__PRERENDER_READY__;
    delete globals().__PRERENDER__;
    delete globals().__PRERENDER_STATE__;
    delete globals().__INITIAL_STATE__;
  });

  it('should signal the prerender script that the page is ready', () => {
    signalPrerenderReady();

    expect(globals().__PRERENDER_READY__).toBe(true);
  });

  it('should report prerender mode only when the flag is present', () => {
    expect(isPrerenderMode()).toBe(false);

    globals().__PRERENDER__ = true;
    expect(isPrerenderMode()).toBe(true);

    globals().__PRERENDER__ = false;
    expect(isPrerenderMode()).toBe(false);
  });

  it('should not publish state outside of the prerender', () => {
    publishPrerenderState({ institucion: null });

    expect(globals().__PRERENDER_STATE__).toBeUndefined();
  });

  it('should publish the resolved state during the prerender', () => {
    globals().__PRERENDER__ = true;
    const state = { institucion: { saldo_total: 1250000 } };

    publishPrerenderState(state);

    expect(globals().__PRERENDER_STATE__).toEqual(state);
  });

  it('should read the initial state embedded in the prerendered html', () => {
    globals().__INITIAL_STATE__ = { institucion: { saldo_total: 1250000 } };

    expect(readInitialState()).toEqual({
      institucion: { saldo_total: 1250000 },
    });
  });

  it('should return null when there is no usable embedded state', () => {
    expect(readInitialState()).toBeNull();

    globals().__INITIAL_STATE__ = null;
    expect(readInitialState()).toBeNull();

    globals().__INITIAL_STATE__ = 'no-es-un-objeto';
    expect(readInitialState()).toBeNull();
  });
});
