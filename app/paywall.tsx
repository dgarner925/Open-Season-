import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { Micro, Pill, Rule, Screen, Sentence, Serif } from '@/components/system';
import { RC_API_KEY, usePremium } from '@/providers/PremiumProvider';
import { openExternalUrl } from '@/lib/openUrl';
import { lang } from '@/theme/tokens';

const { color, space, radius } = lang;

const PRIVACY_POLICY_URL = 'https://dgarner925.github.io/OpenSeason-Legal/';
const TERMS_URL = 'https://dgarner925.github.io/OpenSeason-Legal/terms.html';

const PITCH: { title: string; body: string }[] = [
  { title: 'Never miss an opener.', body: 'Reminders before every season you follow — you pick how far ahead.' },
  { title: 'Every tag deadline.', body: 'Draw application windows and results dates, tracked and pushed.' },
  { title: 'Hunt with your party.', body: 'Share a code, see who has applied, everyone gets the deadline.' },
  { title: 'Your applications and points.', body: 'Track what you applied for and the points you are banking.' },
];

/**
 * The Pro paywall. Free users browse every date in the app; following, alerts,
 * parties, and tracking require the annual subscription. Grandfathered
 * paid-era users never see this screen (gates check isPro first).
 * The plan card is the one sanctioned card here, and the price is the only serif.
 */
export default function Paywall() {
  const router = useRouter();
  const { isPro, refresh } = usePremium();
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [busy, setBusy] = useState<null | 'buy' | 'restore'>(null);

  useEffect(() => {
    if (!RC_API_KEY) return;
    Purchases.getOfferings()
      .then((o) => setPkg(o.current?.annual ?? o.current?.availablePackages[0] ?? null))
      .catch(() => setPkg(null));
  }, []);

  // Already Pro (or just became Pro) — nothing to sell.
  useEffect(() => {
    if (isPro) router.back();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro]);

  // No hardcoded fallback: a wrong price in confident serif is worse than a dash.
  const price = pkg?.product.priceString ?? null;

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
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: 'Open Season Pro' }} />

      <Sentence tone="bone" style={{ marginTop: space.x16 }}>
        Browsing is free, forever. Pro is the reminder machine — it works while you don't.
      </Sentence>

      {PITCH.map((p) => (
        <View key={p.title}>
          <Rule />
          <Sentence tone="bone">{p.title}</Sentence>
          <Sentence style={{ marginTop: 2 }}>{p.body}</Sentence>
        </View>
      ))}

      <Rule />

      {/* The plan — the one card this screen earns; the price is the only serif. */}
      <View style={styles.plan}>
        <Sentence>One plan. Everything above, all year.</Sentence>
        {price ? (
          <Serif size={44} style={{ marginTop: space.x8 }}>
            {price}
          </Serif>
        ) : (
          <Sentence tone="dim" style={{ marginTop: space.x8 }}>
            Loading the price from the App Store…
          </Sentence>
        )}
        <Micro style={{ marginTop: space.x4 }}>Per year · renews automatically</Micro>
      </View>

      <Pill
        label={busy === 'buy' ? 'Opening App Store…' : 'Go Pro'}
        onPress={buy}
        disabled={!pkg || busy !== null}
        style={{ marginTop: space.x16 }}
      />

      <Pressable onPress={restore} disabled={busy !== null} accessibilityRole="button" style={{ marginTop: space.section }}>
        <Sentence tone="dim">
          {busy === 'restore' ? 'Restoring…' : 'Bought Pro before, or the app back when it was paid? Restore purchases.'}
        </Sentence>
      </Pressable>

      <Sentence tone="dim" style={{ marginTop: space.x16, fontSize: 13, lineHeight: 19 }}>
        Payment is charged to your Apple ID at confirmation. Renews automatically unless canceled at least
        24 hours before the end of the period. Manage or cancel anytime in your App Store account settings.
      </Sentence>
      <View style={styles.legalLinks}>
        <Pressable onPress={() => openExternalUrl(TERMS_URL)} hitSlop={8}>
          <Text style={styles.legalLink}>Terms of Service</Text>
        </Pressable>
        <Text style={styles.legalDot}> · </Text>
        <Pressable onPress={() => openExternalUrl(PRIVACY_POLICY_URL)} hitSlop={8}>
          <Text style={styles.legalLink}>Privacy Policy</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  plan: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hair,
    padding: space.gutter,
  },
  legalLinks: { flexDirection: 'row', marginTop: space.x12 },
  legalLink: { fontFamily: lang.type.ui, fontSize: 13, color: color.dim, textDecorationLine: 'underline' },
  legalDot: { fontFamily: lang.type.ui, fontSize: 13, color: color.dim },
});
