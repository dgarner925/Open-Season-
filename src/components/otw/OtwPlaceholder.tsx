/**
 * A screen that exists but has nothing in it yet.
 *
 * Phase 1 ships On the Water's shape before its data. A tab that opens onto
 * an empty page reads as a bug; one that says what it is for and that it is
 * not finished reads as a plan. It says "not built yet" in those words on
 * purpose -- nothing here should ever be mistaken for a real answer about a
 * season or a limit.
 *
 * OTW-only, so it imports otwLang statically, exactly as hunting components
 * import lang. See the note in src/theme/useLang.ts.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { otwLang } from '@/theme/otwTokens';

const { color, space, type } = otwLang;

export function OtwPlaceholder({ title, blurb }: { title: string; blurb: string }) {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>ON THE WATER</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.blurb}>{blurb}</Text>
        <View style={styles.rule} />
        <Text style={styles.note}>Not built yet.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: space.gutter, paddingTop: space.x32, paddingBottom: space.x38 },
  label: {
    fontFamily: type.uiMedium,
    fontSize: type.size.micro,
    letterSpacing: type.microTracking,
    color: color.dim,
  },
  title: {
    fontFamily: type.otwDisplay,
    fontSize: 33,
    color: color.ink,
    marginTop: space.x8,
  },
  blurb: {
    fontFamily: type.ui,
    fontSize: type.size.body,
    lineHeight: 23,
    color: color.muted,
    marginTop: space.x12,
  },
  rule: {
    height: 1,
    backgroundColor: color.hair,
    marginTop: space.section,
    marginBottom: space.x12,
  },
  note: {
    fontFamily: type.uiMedium,
    fontSize: type.size.micro,
    letterSpacing: type.microTracking,
    color: color.brassText,
  },
});
