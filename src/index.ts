/**
 * Public API. Everything else under `src/` is internal math and is deliberately not
 * exported — it must stay free to change without a major version.
 */

export type { ExidState } from './exid.js';
export { createExid, createExidFromState, EXID_BODY_LEN, freshState } from './exid.js';
