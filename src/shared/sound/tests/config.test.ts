import app from '../../../../app.json';

// ADR-009: expo-audio plays the games' tones only. Its config plugin would otherwise ask
// for the microphone (RECORD_AUDIO on Android, a usage string on iOS) and add a
// background-playback service; none of that is wanted.
describe('GIVEN the app config', () => {
  describe('WHEN the store build applies expo-audio’s plugin', () => {
    it('THEN it is playback only: no microphone, no background service', () => {
      expect(app.expo.plugins).toContainEqual([
        'expo-audio',
        { microphonePermission: false, recordAudioAndroid: false, enableBackgroundPlayback: false },
      ]);
    });
    it('THEN Android’s RECORD_AUDIO is blocked even if a library asks for it', () => {
      expect(app.expo.android.blockedPermissions).toContain('android.permission.RECORD_AUDIO');
      expect(app.expo.android.permissions).not.toContain('android.permission.RECORD_AUDIO');
    });
  });
});
