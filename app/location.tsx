import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui';
import { PageTitle } from '@/components/midnight';
import { useActiveStates } from '@/features/reference/queries';
import { useAddLocation, useLocations, useRemoveLocation, useSetActiveLocation, useUnitsForState } from '@/features/locations/queries';
import { useAuth } from '@/providers/AuthProvider';
import { fontFamily, radius, spacing, theme } from '@/theme';

export default function LocationScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { data: states = [] } = useActiveStates();
  const { data: locations = [] } = useLocations();
  const addLocation = useAddLocation();
  const setActive = useSetActiveLocation();
  const removeLocation = useRemoveLocation();

  const [search, setSearch] = useState('');
  const [stateId, setStateId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null); // null = Statewide
  const { data: units = [] } = useUnitsForState(stateId);

  const filtered = states.filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()));
  const activeId = profile?.active_location_id ?? null;

  async function save() {
    if (!stateId) return;
    await addLocation.mutateAsync({ stateId, zoneId });
    router.back();
  }

  async function switchTo(id: string) {
    await setActive.mutateAsync(id);
    router.back();
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.circle} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={theme.color.textPrimary} />
        </Pressable>
        <PageTitle lead={'Where do\nyou '} accent="hunt?" style={styles.title} />

        {/* Saved locations to switch between */}
        {locations.length > 0 ? (
          <View style={styles.section}>
            <AppText variant="overline" color={theme.color.textMuted} style={styles.sectionLabel}>
              YOUR LOCATIONS
            </AppText>
            {locations.map((loc) => {
              const active = loc.id === activeId;
              return (
                <View key={loc.id} style={styles.savedRow}>
                  <Pressable style={styles.savedMain} onPress={() => switchTo(loc.id)}>
                    <View style={[styles.check, active ? styles.checkOn : styles.checkOff]}>
                      {active ? <Ionicons name="checkmark" size={13} color={theme.color.onAccent} /> : null}
                    </View>
                    <Text style={styles.savedText}>
                      {loc.state?.name}
                      {loc.zone?.name ? ` · ${loc.zone.name}` : ''}
                    </Text>
                  </Pressable>
                  <Pressable hitSlop={10} onPress={() => removeLocation.mutate(loc.id)}>
                    <Ionicons name="close" size={16} color={theme.color.textMuted} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={theme.color.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search state"
            placeholderTextColor={theme.color.textMuted}
            style={styles.searchInput}
          />
        </View>

        {/* State list */}
        <View style={styles.section}>
          <AppText variant="overline" color={theme.color.textMuted} style={styles.sectionLabel}>
            STATE
          </AppText>
          {filtered.map((s) => {
            const selected = s.id === stateId;
            return (
              <Pressable
                key={s.id}
                style={styles.stateRow}
                onPress={() => {
                  setStateId(s.id);
                  setZoneId(null);
                }}
              >
                <Text style={[styles.stateName, { color: selected ? theme.color.textPrimary : theme.color.textSecondary }]}>{s.name}</Text>
                {selected ? (
                  <View style={styles.checkOn}>
                    <Ionicons name="checkmark" size={13} color={theme.color.onAccent} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* Units */}
        {stateId ? (
          <View style={styles.section}>
            <AppText variant="overline" color={theme.color.textMuted} style={styles.sectionLabel}>
              GAME MANAGEMENT UNIT
            </AppText>
            <View style={styles.pills}>
              <UnitPill label="Statewide" selected={zoneId === null} onPress={() => setZoneId(null)} />
              {units.map((u) => (
                <UnitPill key={u.id} label={u.name} selected={zoneId === u.id} onPress={() => setZoneId(u.id)} />
              ))}
            </View>
            {units.length === 0 ? (
              <AppText variant="caption" color={theme.color.textMuted} style={{ marginTop: spacing.sm }}>
                No units sourced for this state yet — we'll add them as they're verified.
              </AppText>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable disabled={!stateId || addLocation.isPending} onPress={save} style={[styles.save, (!stateId || addLocation.isPending) && { opacity: 0.45 }]}>
          <Text style={styles.saveLabel}>Save location</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function UnitPill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, selected ? styles.pillOn : styles.pillOff]}>
      <Text style={[styles.pillLabel, { color: selected ? theme.color.onAccent : theme.color.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  circle: { width: 38, height: 38, borderRadius: 19, backgroundColor: theme.color.surfaceFlat, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 44, lineHeight: 50, marginTop: spacing.lg, paddingTop: 3 },

  section: { marginTop: spacing.xl },
  sectionLabel: { marginBottom: spacing.sm },

  savedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.hairline },
  savedMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  savedText: { fontFamily: fontFamily.sansSemiBold, fontSize: 16, color: theme.color.textPrimary },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: theme.color.surfaceFlat, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.borderFlat, marginTop: spacing.xl },
  searchInput: { flex: 1, color: theme.color.textPrimary, fontFamily: fontFamily.sans, fontSize: 15, padding: 0 },

  stateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.hairline },
  stateName: { fontFamily: fontFamily.sansSemiBold, fontSize: 16 },

  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: { paddingHorizontal: spacing.lg, paddingVertical: 9, borderRadius: 20 },
  pillOn: { backgroundColor: theme.color.accent },
  pillOff: { backgroundColor: theme.color.surfaceFlat, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.borderFlat },
  pillLabel: { fontFamily: fontFamily.sansSemiBold, fontSize: 13 },

  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checkOn: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.accent },
  checkOff: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)' },

  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg, backgroundColor: theme.color.background },
  save: { height: 52, borderRadius: 26, backgroundColor: theme.color.accent, alignItems: 'center', justifyContent: 'center' },
  saveLabel: { fontFamily: fontFamily.sansBold, fontSize: 15, color: theme.color.onAccent },
});
