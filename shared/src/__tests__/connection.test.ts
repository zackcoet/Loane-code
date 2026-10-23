import { describe, expect, it } from 'vitest';
import { docPresence, isOfflineState } from '../connection';

describe('docPresence', () => {
  it('a document that exists is present, cached or not', () => {
    expect(docPresence(true, false)).toBe('present');
    expect(docPresence(true, true)).toBe('present');
  });

  it('only the server can say a document is missing', () => {
    expect(docPresence(false, false)).toBe('missing');
  });

  it('a cached "missing" (no signal) is unknown, never missing', () => {
    expect(docPresence(false, true)).toBe('unknown');
  });
});

describe('isOfflineState', () => {
  it('no connection at all is offline', () => {
    expect(isOfflineState({ isConnected: false, isInternetReachable: null })).toBe(true);
  });

  it('wifi with no internet behind it is offline', () => {
    expect(isOfflineState({ isConnected: true, isInternetReachable: false })).toBe(true);
  });

  it('not yet checked is not offline — no flash on launch', () => {
    expect(isOfflineState({ isConnected: null, isInternetReachable: null })).toBe(false);
    expect(isOfflineState({ isConnected: true, isInternetReachable: null })).toBe(false);
    expect(isOfflineState({ isConnected: true })).toBe(false);
  });

  it('connected and reachable is online', () => {
    expect(isOfflineState({ isConnected: true, isInternetReachable: true })).toBe(false);
  });
});
