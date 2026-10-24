import * as api from '../api/board';
import { rpc } from '../api/client';

jest.mock('../api/client', () => ({ rpc: jest.fn(async () => null) }));
const call = jest.mocked(rpc);

const P = 'pid';
describe('GIVEN the typed board calls', () => {
  it('THEN each sends its SQL function’s exact argument names', async () => {
    await api.boardMine(P);
    await api.boardPeek('C');
    await api.boardDay(P, 'C', 'mini', '2026-10-24');
    await api.boardOverall(P, 'C', '2026-10-24');
    await api.boardCreate(P, 'Family', 'Alec');
    await api.boardJoin(P, 'C', 'Alec');
    await api.boardLeave(P, 'C');
    await api.boardRename(P, 'C', 'New');
    await api.boardNewCode(P, 'C');
    await api.boardRemove(P, 'C', 'Ma');
    await api.boardClose(P, 'C');
    await api.boardLetBack(P, 'C', 'Ma');
    await api.boardPinSet(P, '1234');
    await api.boardClaim('C', 'Ma', '1234');
    await api.boardSubmit({
      p_player: P,
      p_path: 'reports/x.html',
      p_outcome: 'solved',
      p_secs: 9,
      p_score: null,
      p_mistakes: null,
    });
    await api.boardBackfill(P, null, []);
    expect(call.mock.calls).toEqual([
      ['board_mine', { p_player: P }],
      ['board_peek', { p_code: 'C' }],
      ['board_day', { p_player: P, p_code: 'C', p_type: 'mini', p_date: '2026-10-24' }],
      ['board_overall', { p_player: P, p_code: 'C', p_date: '2026-10-24' }],
      ['board_create', { p_player: P, p_name: 'Family', p_nick: 'Alec' }],
      ['board_join', { p_player: P, p_code: 'C', p_nick: 'Alec' }],
      ['board_leave', { p_player: P, p_code: 'C' }],
      ['board_rename', { p_player: P, p_code: 'C', p_name: 'New' }],
      ['board_new_code', { p_player: P, p_code: 'C' }],
      ['board_remove', { p_player: P, p_code: 'C', p_nick: 'Ma' }],
      ['board_close', { p_player: P, p_code: 'C' }],
      ['board_let_back', { p_player: P, p_code: 'C', p_nick: 'Ma' }],
      ['board_pin_set', { p_player: P, p_pin: '1234' }],
      ['board_claim', { p_code: 'C', p_nick: 'Ma', p_pin: '1234' }],
      [
        'board_submit',
        {
          p_player: P,
          p_path: 'reports/x.html',
          p_outcome: 'solved',
          p_secs: 9,
          p_score: null,
          p_mistakes: null,
        },
      ],
      ['board_backfill', { p_player: P, p_aid: null, p_rows: [] }],
    ]);
  });
});
