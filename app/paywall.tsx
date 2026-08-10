import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { AppText, Button, Screen } from '@/components/ui';
import { PageTitle } from '@/components/midnight';
import { usePremium } from '@/providers/PremiumProvider';
import { openExternalUrl } from '@/lib/openUrl';
import { spacing, theme } from '@/theme';

const PRIVACY_POLICY_URL = 'https://dgarner925.github.io/OpenSeason-Legal/';
const TERMS_URL = 'https://dgarner925.github.io/OpenSeason-Legal/terms.html';

const PITCH: { title: string; body: string }[] = [
  { title: 'Never miss an opener', body: 'Reminders before every season you follow — you pick how far ahead.' },
  { title: 'Every tag deadline', body: 'Draw application windows and results dates, tracked and pushed.' },
  { title: 'Hunt with your party', body: 'Share a code, see who has applied, everyone gets the deadline.' },
  { title: 'Your applications & points', body: 'Track what you applied for and the points you are banking.' },
];

/**
 * The Pro paywall. Free users browse every date in the app; following, alerts,
 * parties, and tracking require the annual subscription. Grandfathered
 * paid-era users never see this screen (gates check isPro first).
 */
export default function Paywall() {
  const router = useRouter();
  const { isPro, refresh } = usePremium();
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [busy, setBusy] = useState<null | 'buy' | 'restore'>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    Purchases.getOfferings()
      .then((o) => setPkg(o.current?.annual ?? o.current?.availablePackages[0] ?? null))
      .catch(() => setPkg(null));
  }, []);

  // Already Pro (or just became Pro) — nothing to sell.
  useEffect(() => {
    if (isPro) router.back();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro]);

  const price = pkg?.product.priceString ?? '$9.99';

  async function buy() {
    if (!pkg) return;
    setBusy('buy');
    try {
      await Purchases.purchasePackage(pkg);
      await refresh();
    } catch (e: unknown) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (!err.userCancelled) {
        Alert.alert('Purchase failed', err.message ?? 'Please try again in a moment.');
      }
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy('restore');
    try {
      await Purchases.restorePurchases();
      await refresh();
    } catch {
      Alert.alert('Nothing to restore', 'No previous purchase was found for this Apple ID.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen scroll contentStyle={{ paddingBottom: spacing.xxl }}>
      <Stack.Screen options={{ headerShown: true, title: '' }} />
      <View style={styles.hero}>
        <AppText variant="overline" color={theme.color.textMuted}>
          OPEN SEASON PRO
        </AppText>
        <PageTitle lead={'Every season.\n'} accent="Zero missed." style={styles.title} />
        <AppText variant="body" color={theme.color.textSecondary} style={{ marginTop: spacing.sm }}>
          Browsing is free, forever. Pro is the reminder machine — it works while you don't.
        </AppText>
      </View>

      <View style={styles.pitch}>
        {PITCH.map((p) => (
          <View key={p.title} style={styles.pitchRow}>
            <View style={styles.tick} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{p.title}</AppText>
              <AppText variant="caption" color={theme.color.textSecondary}>
                {p.body}
              </AppText>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.cta}>
        <Button
          title={busy === 'buy' ? 'Opening App Store…' : `Go Pro — ${price} / year`}
          onPress={buy}
          loading={busy === 'buy'}
          disabled={!pkg || busy !== null}
        />
        <Button
          variant="ghost"
          title={busy === 'restore' ? 'Restoring…' : 'Restore purchases'}
          onPress={restore}
          loading={busy === 'restore'}
          disabled={busy !== null}
        />
      </View>

      <AppText variant="caption" color={theme.color.textMuted} style={styles.legal}>
        Annual subscription, {price}/year. Payment is charged to your Apple ID at confirmation. Renews
        automatically unless canceled at least 24 hours before the end of the period. Manage or cancel
        anytime in your App Store account settings. Bought the app before it went free? Your access is
        permanent — tap Restore purchases if it doesn't show.
      </AppText>
      <View style={styles.legalLinks}>
        <Pressable onPress={() => openExternalUrl(TERMS_URL)} hitSlop={8}>
          <AppText variant="caption" color={theme.color.accent}>
            Terms of Service
          </AppText>
        </Pressable>
        <AppText variant="caption" color={theme.color.textMuted}>
          {'  ·  '}
        </AppText>
        <Pressable onPress={() => openExternalUrl(PRIVACY_POLICY_URL)} hitSlop={8}>
          <AppText variant="caption" color={theme.color.accent}>
            Privacy Policy
          </AppText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: spacing.md },
  title: { fontSize: 40, lineHeight: 46, marginTop: spacing.xs, paddingTop: 3 },
  pitch: { marginTop: spacing.xl, gap: spacing.lg },
  pitchRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  tick: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.color.accent,
    marginTop: 7,
  },
  cta: { marginTop: spacing.xl, gap: spacing.sm },
  legal: { marginTop: spacing.lg, lineHeight: 18 },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.md },
});
