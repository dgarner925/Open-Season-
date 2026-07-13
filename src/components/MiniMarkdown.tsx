import { StyleSheet, View } from 'react-native';
import { spacing, theme } from '@/theme';
import { AppText } from './ui';

/**
 * Tiny, dependency-free markdown renderer for regs summaries. Supports the
 * subset our content uses: # / ## headings, - bullets, blank-line paragraphs,
 * and **bold** inline. If we need full markdown later, swap in
 * react-native-markdown-display (a new dependency — confirm first).
 */
export function MiniMarkdown({ body }: { body: string }) {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  return (
    <View style={styles.container}>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (line.trim() === '') return <View key={i} style={styles.gap} />;
        if (line.startsWith('## ')) {
          return (
            <AppText key={i} variant="h3" style={styles.heading}>
              {line.slice(3)}
            </AppText>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <AppText key={i} variant="h2" style={styles.heading}>
              {line.slice(2)}
            </AppText>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <View key={i} style={styles.bulletRow}>
              <AppText variant="body" color={theme.color.accent}>
                •
              </AppText>
              <AppText variant="body" style={{ flex: 1 }}>
                {renderInline(line.slice(2))}
              </AppText>
            </View>
          );
        }
        return (
          <AppText key={i} variant="body">
            {renderInline(line)}
          </AppText>
        );
      })}
    </View>
  );
}

/** Render **bold** spans; everything else is plain. */
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <AppText key={i} variant="bodyStrong">
        {part.slice(2, -2)}
      </AppText>
    ) : (
      part
    ),
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  heading: { marginTop: spacing.sm },
  gap: { height: spacing.xs },
  bulletRow: { flexDirection: 'row', gap: spacing.sm },
});
