import * as yup from 'yup';

/** An email address to send the sign-in link to. */
export const emailSchema = yup
  .string()
  .trim()
  .lowercase()
  .required('Enter your email address.')
  .max(254, 'That email address is too long.')
  .email('That doesn’t look like an email address.');
