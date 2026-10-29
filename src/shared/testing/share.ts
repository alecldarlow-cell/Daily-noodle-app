/* What the finish sheet's Share result sends, without the short link after it (AF-019:
   the line is no longer drawn on the sheet; it goes to the phone's share sheet). */
import { act, fireEvent, screen } from '@testing-library/react-native';
import { Share } from 'react-native';

export async function sharedLine(): Promise<string> {
  const spy = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
  try {
    await fireEvent.press(screen.getByTestId('finish-share-button'));
    await act(async () => {});
    const call = spy.mock.calls.at(-1)?.[0] as { message?: string } | undefined;
    if (!call?.message) throw new Error('Share result sent nothing');
    return call.message.replace(/\ndailynoodle\.co\.uk\/[a-z]+$/, '');
  } finally {
    spy.mockRestore();
  }
}
