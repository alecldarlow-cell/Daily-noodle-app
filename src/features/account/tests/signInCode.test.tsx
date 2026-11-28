import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { FEATURES_KEY } from '@/shared/features';

import { SyncCard } from '../components/SyncCard/SyncCard';
import { AUTH_WORDS, codeMessage } from '../hooks/authErrors';
import { verifyCode } from '../hooks/useAccount';
import { fakeClient, memoryStorage } from './fakeClient';

const flush = () => act(async () => {});
const CODE_ON = { [FEATURES_KEY]: { archive: true, stats: true, signInCode: true } };

/** Render the signed-out card and send a link to alec@example.com. */
async function sendLink(store = memoryStorage(CODE_ON)) {
  const fake = fakeClient();
  await render(<SyncCard client={fake.client} store={store} />);
  await flush();
  await act(async () => fireEvent.changeText(screen.getByTestId('sync-email'), 'alec@example.com'));
  await act(async () => fireEvent.press(screen.getByTestId('sync-send')));
  return fake;
}

describe('GIVEN the site hasn’t turned the sign-in code on (#215)', () => {
  it('WHEN a link is sent THEN the card is as before: no code box', async () => {
    await sendLink(memoryStorage());
    expect(screen.getByTestId('sync-sent')).toHaveTextContent(
      'We’ve sent a link to alec@example.com. Open it on this phone.',
    );
    expect(screen.queryByTestId('sync-code')).toBeNull();
    expect(screen.queryByTestId('sync-code-send')).toBeNull();
  });
});

describe('GIVEN the site has turned the sign-in code on (#215)', () => {
  it('WHEN a link is sent THEN the card offers the code too, in a labelled number box', async () => {
    await sendLink();
    expect(screen.getByTestId('sync-sent')).toHaveTextContent(
      'We’ve sent a link to alec@example.com. Open it on this phone, or type the code from the email here.',
    );
    const box = screen.getByLabelText('Code from the email');
    expect(box).toBe(screen.getByTestId('sync-code'));
    expect(box.props.keyboardType).toBe('number-pad');
    expect(box.props.textContentType).toBe('oneTimeCode');
    expect(screen.getByRole('button', { name: 'Sign in with the code' })).toBeOnTheScreen();
  });

  it('WHEN the right code is typed, spaces and all, THEN the player is signed in', async () => {
    const { raw } = await sendLink();
    await act(async () => fireEvent.changeText(screen.getByTestId('sync-code'), ' 123 456 '));
    await act(async () => fireEvent.press(screen.getByTestId('sync-code-send')));
    await flush();
    expect(raw.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'alec@example.com',
      token: '123456',
      type: 'email',
    });
    expect(await screen.findByTestId('sync-signed-in')).toHaveTextContent('alec@example.com');
  });

  it('WHEN the code is submitted from the keyboard THEN it is checked the same way', async () => {
    const { raw } = await sendLink();
    await act(async () => fireEvent.changeText(screen.getByTestId('sync-code'), '123456'));
    await act(async () => fireEvent(screen.getByTestId('sync-code'), 'submitEditing'));
    await flush();
    expect(raw.auth.verifyOtp).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId('sync-signed-in')).toBeOnTheScreen();
  });

  it('WHEN a wrong or old code is typed THEN the house’s words say so and the box stays', async () => {
    await sendLink();
    await act(async () => fireEvent.changeText(screen.getByTestId('sync-code'), '654321'));
    await act(async () => fireEvent.press(screen.getByTestId('sync-code-send')));
    expect(await screen.findByTestId('sync-msg')).toHaveTextContent(AUTH_WORDS.badCode);
    expect(screen.getByTestId('sync-code')).toBeOnTheScreen();
    expect(screen.queryByText(/Token has expired/)).toBeNull();
  });

  it('WHEN letters are typed THEN it asks for the numbers and doesn’t ask Supabase', async () => {
    const { raw } = await sendLink();
    await act(async () => fireEvent.changeText(screen.getByTestId('sync-code'), 'abc'));
    await act(async () => fireEvent.press(screen.getByTestId('sync-code-send')));
    expect(await screen.findByTestId('sync-msg')).toHaveTextContent(AUTH_WORDS.codeShape);
    expect(raw.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('WHEN “Use a different email” is tapped THEN the typed code goes too', async () => {
    await sendLink();
    await act(async () => fireEvent.changeText(screen.getByTestId('sync-code'), '12'));
    await act(async () =>
      fireEvent.press(screen.getByRole('button', { name: 'Use a different email' })),
    );
    await act(async () => fireEvent.press(screen.getByTestId('sync-send')));
    expect(screen.getByTestId('sync-code').props.value).toBe('');
  });
});

describe('GIVEN verifyCode on its own (#215)', () => {
  it('THEN a build without sign-in says so', async () => {
    await expect(verifyCode('a@b.co', '123456', null)).rejects.toThrow(
      'Sign-in isn’t available in this build.',
    );
  });

  it('THEN codes of 6 to 10 digits go to Supabase; shorter or longer don’t', async () => {
    const { client, raw } = fakeClient();
    await expect(verifyCode('a@b.co', '12345', client)).rejects.toThrow(AUTH_WORDS.codeShape);
    await expect(verifyCode('a@b.co', '12345678901', client)).rejects.toThrow(AUTH_WORDS.codeShape);
    await expect(verifyCode('a@b.co', '1234567890', client)).rejects.toThrow(AUTH_WORDS.badCode);
    expect(raw.auth.verifyOtp).toHaveBeenCalledTimes(1);
  });

  it('THEN no connection reads as no connection, not a bad code', async () => {
    const { client } = fakeClient({ fail: 'TypeError: Network request failed' });
    await expect(verifyCode('a@b.co', '123456', client)).rejects.toThrow(AUTH_WORDS.offline);
  });

  it('THEN codeMessage swaps only the expired-link line for the code’s', () => {
    expect(codeMessage('Token has expired or is invalid')).toBe(AUTH_WORDS.badCode);
    expect(codeMessage('Email rate limit exceeded')).toBe(AUTH_WORDS.rateLimit);
    expect(codeMessage(null)).toBe(AUTH_WORDS.wrong);
  });
});
