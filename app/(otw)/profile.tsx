/**
 * On the Water -- Profile.
 *
 * The real Settings screen, re-exported rather than reimplemented: it is the
 * same account, the same sign-out and the same alerts. A placeholder here
 * would take working function away from the app in water mode, which is a
 * worse trade than the one being made instead.
 *
 * The trade: Settings imports `lang` statically, so it renders in the woods'
 * near-black under a cream tab bar. That is a known Phase 1 state. Converting
 * it to useLang() is a Phase 2 job and has to keep its hunting output
 * pixel-identical, which is why it is not being rushed into this commit.
 */
export { default } from '../(tabs)/settings';
