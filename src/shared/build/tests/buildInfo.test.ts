import { buildLine } from '../buildInfo';

let mockUpdates: Record<string, unknown> = {};
jest.mock('expo-updates', () => ({
  get channel() {
    return mockUpdates.channel;
  },
  get updateId() {
    return mockUpdates.updateId;
  },
  get isEmbeddedLaunch() {
    return mockUpdates.isEmbeddedLaunch;
  },
}));
jest.mock('expo-constants', () => ({ expoConfig: { version: '0.1.0' } }));

describe('GIVEN the running build', () => {
  it('THEN a downloaded update is named by its id', () => {
    mockUpdates = { channel: 'preview', updateId: '1a2b3c4d-5e6f-7a8b', isEmbeddedLaunch: false };
    expect(buildLine()).toBe('Version 0.1.0 · preview · update 1a2b3c4d');
  });
  it('THEN the code that shipped in the build reads as built-in', () => {
    mockUpdates = { channel: 'production', updateId: 'x', isEmbeddedLaunch: true };
    expect(buildLine()).toBe('Version 0.1.0 · production · built-in');
  });
  it('THEN a development run says so', () => {
    mockUpdates = {};
    expect(buildLine()).toBe('Version 0.1.0 · dev · built-in');
  });
});
