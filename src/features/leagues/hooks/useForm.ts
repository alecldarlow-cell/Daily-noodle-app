import { useState } from 'react';

import { sayError } from '../api/errors';
import { cleaned, firstError } from '../schemas';

type Schema = { validateSync(v: unknown): unknown; cast(v: unknown): unknown };

/**
 * A small form: field values, a Yup check before sending, and the message line under
 * the form (the site's `.msg`): the first problem, or the server's reason in the site's
 * words (never a library's raw text).
 */
export function useForm<V extends Record<string, string>>(initial: V, schema: Schema) {
  const [values, setValues] = useState<V>(initial);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof V) => (text: string) => setValues((v) => ({ ...v, [k]: text }));
  async function submit(send: (clean: V) => Promise<unknown>) {
    if (busy) return;
    const problem = firstError(schema, values);
    if (problem) {
      setMsg(problem);
      return;
    }
    setMsg('');
    setBusy(true);
    try {
      await send(cleaned<V>(schema, values));
    } catch (e) {
      setMsg(sayError(e));
    } finally {
      setBusy(false);
    }
  }
  return { values, set, msg, setMsg, busy, submit };
}
