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
}

/** Inserta el bloque JSON que deja el prerender en el HTML final. */
function setInitialState(json: string): void {
  document.getElementById('__INITIAL_STATE__')?.remove();

  const element = document.createElement('script');
  element.type = 'application/json';
  element.id = '__INITIAL_STATE__';
  element.textContent = json;
  document.body.appendChild(element);
}

function globals(): PrerenderWindow {
  return window as unknown as PrerenderWindow;
}

describe('prerender utilities', () => {
  afterEach(() => {
    delete globals().__PRERENDER_READY__;
    delete globals().__PRERENDER__;
    delete globals().__PRERENDER_STATE__;
    document.getElementById('__INITIAL_STATE__')?.remove();
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

  it('should read the JSON state embedded in the prerendered html', () => {
    setInitialState(JSON.stringify({ institucion: { saldo_total: 1250000 } }));

    expect(readInitialState()).toEqual({
      institucion: { saldo_total: 1250000 },
    });
  });

  it('should return null when there is no embedded state', () => {
    expect(readInitialState()).toBeNull();
  });

  it('should return null for malformed JSON or a non-object value', () => {
    setInitialState('{no-es-json');
    expect(readInitialState()).toBeNull();

    setInitialState('"solo-un-string"');
    expect(readInitialState()).toBeNull();

    setInitialState('null');
    expect(readInitialState()).toBeNull();
  });

  it('should not execute the embedded state as JavaScript', () => {
    setInitialState(JSON.stringify({ institucion: { saldo_total: 1 } }));

    // El bloque es application/json: no crea una variable global ejecutable.
    expect((window as any).__INITIAL_STATE__).toBeUndefined();
    expect(
      (document.getElementById('__INITIAL_STATE__') as HTMLScriptElement).type,
    ).toBe('application/json');
  });
});
