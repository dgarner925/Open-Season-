/**
 * One source of truth for "is this a question or a keyword search?" — shared
 * with the ask-book Edge Function so the client and the server never disagree
 * about what gets routed to the model. The implementation (and its tests) live
 * next to the function.
 */
export { looksLikeQuestion, normalizeQuestion } from '../../../supabase/functions/_shared/grounding';
