import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pill, Sentence, Serif } from '@/components/system';
import { useActiveStates } from '@/features/reference/queries';
import { useAddLocation, useLocations, useRemoveLocation, useSetActiveLocation, useUnitsForState } from '@/features/locations/queries';
import { useAuth } from '@/providers/AuthProvider';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

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
  const [zoneId, setZoneId] = useState<string | null>(null); // null = Statewide (a real sentinel)
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

  const check = (on: boolean) => (on ? <Ionicons name="checkmark" size={18} color={color.copper} /> : null);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color={color.bone} />
        </Pressable>
        <Sentence style={{ marginTop: space.x16 }}>
          Where you hunt — the state (and unit, if you know it) the app should think from.
        </Sentence>

        {/* Saved locations to switch between */}
        {locations.length > 0 ? (
          <>
            <View style={styles.rule} />
            <Serif size={22} style={{ marginBottom: space.x4 }}>
              Your locations
            </Serif>
            {locations.map((loc, i) => {
              const active = loc.id === activeId;
              return (
                <View key={loc.id} style={styles.row}>
                  <Pressable style={styles.rowMain} onPress={() => switchTo(loc.id)} accessibilityRole="button">
                    <Text style={[styles.rowText, { color: active ? color.bone : color.muted }]}>
                      {loc.state?.name}
                      {loc.zone?.name ? ` · ${loc.zone.name}` : ''}
                    </Text>
                    {check(active)}
                  </Pressable>
                  <Pressable hitSlop={10} onPress={() => removeLocation.mutate(loc.id)} accessibilityLabel="Remove location">
                    <Ionicons name="close" size={15} color={color.dim} />
                  </Pressable>
                  {i !== locations.length - 1 ? <View style={styles.rowRule} /> : null}
                </View>
              );
            })}
          </>
        ) : null}

        <View style={styles.rule} />
        <Serif size={22} style={{ marginBottom: space.x8 }}>
          Add a location
        </Serif>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={15} color={color.dim} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search state"
            placeholderTextColor={color.dim}
            style={styles.searchInput}
          />
        </View>

        {filtered.map((s, i) => {
          const selected = s.id === stateId;
          return (
            <Pressable
              key={s.id}
              style={styles.row}
              onPress={() => {
                setStateId(s.id);
                setZoneId(null);
              }}
              accessibilityRole="button"
            >
              <Text style={[styles.rowText, { flex: 1, color: selected ? color.bone : color.muted }]}>{s.name}</Text>
              {check(selected)}
              {i !== filtered.length - 1 ? <View style={styles.rowRule} /> : null}
            </Pressable>
          );
        })}

        {/* Units — a list with a copper check, "Statewide" as an explicit first row. */}
        {stateId ? (
          <>
            <View style={styles.rule} />
            <Sentence style={{ marginBottom: space.x8 }}>Narrow it to a unit, or keep the whole state.</Sentence>
            <Pressable style={styles.row} onPress={() => setZoneId(null)} accessibilityRole="button">
              <Text style={[styles.rowText, { flex: 1, color: zoneId === null ? color.bone : color.muted }]}>Statewide</Text>
              {check(zoneId === null)}
              <View style={styles.rowRule} />
            </Pressable>
            {units.map((u, i) => (
              <Pressable key={u.id} style={styles.row} onPress={() => setZoneId(u.id)} accessibilityRole="button">
                <Text style={[styles.rowText, { flex: 1, color: zoneId === u.id ? color.bone : color.muted }]}>{u.name}</Text>
                {check(zoneId === u.id)}
                {i !== units.length - 1 ? <View style={styles.rowRule} /> : null}
              </Pressable>
            ))}
            {units.length === 0 ? (
              <Sentence tone="dim" style={{ fontSize: 13, marginTop: space.x8 }}>
                No units sourced for this state yet — we'll add them as they're verified.
              </Sentence>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.rule} />
        <Pill label="Save location" onPress={save} disabled={!stateId || addLocation.isPending} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: space.gutter, paddingTop: space.x16, paddingBottom: space.x32 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: color.hair, marginHorizontal: -space.gutter, marginVertical: space.section },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.x12, paddingVertical: space.x12, minHeight: 44 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.x12 },
  rowRule: {
    position: 'absolute',
    left: 0,
    right: -space.gutter,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.hair,
  },
  rowText: { fontFamily: type.ui, fontSize: type.size.body + 0.5 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.x8,
    paddingVertical: space.x12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hair,
  },
  searchInput: { flex: 1, color: color.bone, fontFamily: type.ui, fontSize: 15, padding: 0 },
  footer: { paddingHorizontal: space.gutter, paddingBottom: space.x16, backgroundColor: color.bg },
});
