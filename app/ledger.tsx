/**
 * The application ledger — every tracked draw as a bookkeeper sees it: what it
 * cost, the points behind it, and when you'll hear. Pure aggregation of
 * user_applications + user_point_balances; nothing new is stored.
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen, Sentence, Serif } from '@/components/system';
import { useApplications, type ApplicationWithRefs } from '@/features/applications/queries';
import { usePointBalances } from '@/features/points/queries';
import { formatDate } from '@/lib/date';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

/** "$341", "341.50", "$120 res / $341 nonres" → first dollar figure, or null. */
function parseFee(s: string | null): number | null {
  const m = /\$?\s*([\d,]+(?:\.\d{1,2})?)/.exec(s ?? '');
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function subLine(a: ApplicationWithRefs): string {
  const parts: string[] = [];
  if (a.applied_on) parts.push(`applied ${formatDate(a.applied_on)}`);
  else if (a.status === 'planned') parts.push('not yet applied');
  else if (a.status === 'purchased') parts.push('bought over the counter');
  if (a.points) parts.push(`${a.points} point${a.points === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

function rightLine(a: ApplicationWithRefs): { text: string; tone: 'copper' | 'muted' | 'dim' } {
  if (a.status === 'successful') return { text: 'drawn ✓', tone: 'copper' };
  if (a.status === 'unsuccessful') return { text: 'not drawn', tone: 'dim' };
  if (a.status === 'purchased') return { text: 'purchased', tone: 'muted' };
  if (a.results_on) return { text: `results ${formatDate(a.results_on)}`, tone: 'muted' };
  return { text: '', tone: 'dim' };
}

export default function Ledger() {
  const router = useRouter();
  const { data: apps = [], isLoading } = useApplications();
  const { data: balances = [] } = usePointBalances();

  const pending = apps.filter((a) => a.status === 'applied');
  const riding = pending.reduce((t, a) => t + (parseFee(a.fee_summary) ?? 0), 0);
  const heldPoints = balances.reduce((t, b) => t + (b.points ?? 0), 0);

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: '' }} />
      <Serif size={type.size.hero - 12} style={{ marginTop: space.x16, lineHeight: type.size.hero - 6 }}>
        Your applications.
      </Serif>
      <Sentence style={{ marginTop: space.x8 }}>Every draw you're in, what it cost, and when you'll hear.</Sentence>

      {isLoading ? (
        <ActivityIndicator color={color.copper} style={{ marginTop: space.x38 }} />
      ) : apps.length === 0 ? (
        <Sentence style={{ marginTop: space.section }}>
          Nothing tracked yet. Open any draw and tap "Track this application under Tags" — it lands here.
        </Sentence>
      ) : (
        <>
          <View style={styles.tile}>
            {apps.map((a, i) => {
              const fee = parseFee(a.fee_summary);
              const right = rightLine(a);
              return (
                <Pressable
                  key={a.id}
                  onPress={() => router.push({ pathname: '/application-edit', params: { id: a.id } })}
                  style={[styles.row, i !== apps.length - 1 && styles.rowRule]}
                  accessibilityRole="button"
                >
                  <View style={{ flex: 1, paddingRight: space.x12 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {a.title}
                    </Text>
                    {subLine(a) ? <Text style={styles.sub}>{subLine(a)}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Serif size={19} style={fee == null ? { color: color.dim } : undefined}>
                      {fee == null ? '—' : `$${fee.toLocaleString()}`}
                    </Serif>
                    {right.text ? (
                      <Text
                        style={[
                          styles.right,
                          right.tone === 'copper' && { color: color.copper, fontFamily: type.uiSemiBold },
                          right.tone === 'dim' && { color: color.dim },
                        ]}
                      >
                        {right.text}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={color.copper} style={{ marginLeft: space.x8 }} />
                </Pressable>
              );
            })}
          </View>

          {riding > 0 || heldPoints > 0 ? (
            <View style={styles.totalRow}>
              {riding > 0 ? (
                <Serif size={28} copper>
                  ${riding.toLocaleString()}
                </Serif>
              ) : null}
              <Sentence style={{ flex: 1 }}>
                {riding > 0 ? `riding on ${pending.length} draw${pending.length === 1 ? '' : 's'}` : 'No fees riding'}
                {heldPoints > 0 ? ` · ${heldPoints} point${heldPoints === 1 ? '' : 's'} held` : ''}
              </Sentence>
            </View>
          ) : null}
          <Sentence tone="dim" style={{ marginTop: space.x12, marginBottom: space.section, fontSize: 13 }}>
            Totals come from the fees you enter on each application.
          </Sentence>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tile: {
    marginTop: space.x16,
    paddingHorizontal: space.gutter,
    borderRadius: lang.radius.card,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hair,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.x12, minHeight: 56 },
  rowRule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hair },
  name: { fontFamily: type.uiSemiBold, fontSize: type.size.body, color: color.bone },
  sub: { fontFamily: type.ui, fontSize: 12.5, color: color.dim, marginTop: 2 },
  right: { fontFamily: type.ui, fontSize: 12.5, color: color.muted, marginTop: 2 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.x12, marginTop: space.x16 },
});
