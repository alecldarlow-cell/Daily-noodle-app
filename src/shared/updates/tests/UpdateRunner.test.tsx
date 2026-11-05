import { act, render } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { UpdateRunner } from '../UpdateRunner';

let mockPath = '/';
jest.mock('expo-router', () => ({ usePathname: () => mockPath }));
jest.mock('expo-updates', () => ({}));

describe('GIVEN the root of the app', () => {
  it('WHEN it mounts and returns to the front THEN it asks for updates, and tidies up', async () => {
    let change: (s: string) => void = () => {};
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _: string,
      fn: (s: string) => void,
    ) => {
      change = fn;
      return { remove };
    }) as never);
    const updates = {
      isEnabled: true,
      checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false })),
      fetchUpdateAsync: jest.fn(async () => ({ isNew: false })),
      reloadAsync: jest.fn(async () => undefined),
    };
    const view = await render(<UpdateRunner updates={updates} />);
    await act(async () => undefined);
    expect(updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    await act(async () => {
      change('background');
      change('active');
    });
    mockPath = '/play/mini/x';
    await view.rerender(<UpdateRunner updates={updates} />);
    await view.unmount();
    expect(remove).toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});
