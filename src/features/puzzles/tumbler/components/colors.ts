/** Tumbler's own clue colours (engines/tumbler.css --good, --amber, --miss), light and dark. */
export function tumblerColors(dark: boolean) {
  return {
    good: dark ? '#2FA874' : '#157A52',
    amber: '#E0A92E',
    miss: dark ? '#4A5066' : '#B9BECB',
    onClue: '#FFFFFF',
    onAmber: '#141726',
  };
}
