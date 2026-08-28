import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Sentence, Serif } from '@/components/system';
import { SpeciesBadge } from '@/components/midnight';
import { useActiveStates, useSpecies, useStateSpecies } from '@/features/reference/queries';
import { useFollows, usePermitFollows, useTogglePermitFollow, useToggleFollow } from '@/features/follows/queries';
import { openExternalUrl } from '@/lib/openUrl';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'big_game', label: 'Big game' },
  { key: 'turkey', label: 'Turkey' },
  { key: 'waterfowl', label: 'Waterfowl & migratory' },
  { key: 'upland', label: 'Upland birds' },
  { key: 'small_game', label: 'Small game' },
  { key: 'furbearer', label: 'Furbearers' },
  { key: 'other', label: 'Other' },
];

/**
 * Add hunts with one state dropdown → animal rows, and see/remove your current
 * hunts as hairline-ruled ledgers grouped by state.
 */
export function HuntPicker() {
  const { data: states = [], isLoading } = useActiveStates();
  const { data: species = [] } = useSpecies();
  const { data: follows = [] } = useFollows();
  const { data: permitFollows = [] } = usePermitFollows();
  const toggle = useToggleFollow();
  const togglePermit = useTogglePermitFollow();

  const [stateId, setStateId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const followKey = new Map(follows.map((f) => [`${f.state_id}:${f.species_id}`, f.id]));
  const nameOf = (id: string, list: { id: string; name: string }[]) => list.find((x) => x.id === id)?.name ?? '';
  const codeOf = (id: string) => states.find((s) => s.id === id)?.code ?? '';
  const selectedState = states.find((s) => s.id === stateId) ?? null;
  const { data: stateSpecies = [], isLoading: speciesLoading } = useStateSpecies(stateId);

  if (isLoading) return <ActivityIndicator color={color.copper} style={{ marginTop: space.x16 }} />;

  return (
    <View>
      {/* Current hunts, grouped by state under hairline rules. */}
      {follows.length > 0 ? (
        [...new Set(follows.map((f) => f.state_id))]
          .sort((a, b) => nameOf(a, states).localeCompare(nameOf(b, states)))
          .map((sid) => {
            const rows = follows
              .filter((f) => f.state_id === sid)
              .sort((a, b) => nameOf(a.species_id, species).localeCompare(nameOf(b.species_id, species)));
            return (
              <View key={sid}>
                <View style={styles.rule} />
                <Serif size={22} style={{ marginBottom: space.x4 }}>
                  {nameOf(sid, states) || codeOf(sid)}
                </Serif>
                {rows.map((f, i) => (
                  <View key={f.id} style={styles.row}>
                    <SpeciesBadge name={nameOf(f.species_id, species)} size={34} muted />
                    <Text style={[styles.rowText, { flex: 1, color: color.bone }]}>
                      {nameOf(f.species_id, species)}
                    </Text>
                    <Pressable
                      hitSlop={10}
                      disabled={toggle.isPending}
                      onPress={() => toggle.mutate({ stateId: f.state_id, speciesId: f.species_id, existingId: f.id })}
                      style={({ pressed }) => pressed && { opacity: 0.5 }}
                      accessibilityLabel={`Unfollow ${nameOf(f.species_id, species)}`}
                    >
                      <Ionicons name="close" size={15} color={color.dim} />
                    </Pressable>
                    {i !== rows.length - 1 ? <View style={styles.rowRule} /> : null}
                  </View>
                ))}
              </View>
            );
          })
      ) : (
        <Sentence tone="dim" style={{ fontSize: 13 }}>
          No hunts yet — add your first below.
        </Sentence>
      )}

      {/* Followed federal permit hunts (Recreation.gov), removable like any hunt. */}
      {permitFollows.filter((f) => f.hunt).length > 0 ? (
        <View>
          <View style={styles.rule} />
          <Serif size={22} style={{ marginBottom: space.x4 }}>
            Federal permit hunts
          </Serif>
          {permitFollows
            .filter((f) => f.hunt)
            .sort((a, b) => (a.hunt!.name < b.hunt!.name ? -1 : 1))
            .map((f, i, arr) => (
              <View key={f.id} style={styles.row}>
                <View style={styles.permitTile}>
                  <Ionicons name="ribbon-outline" size={15} color={color.dim} />
                </View>
                <Pressable style={{ flex: 1 }} onPress={() => openExternalUrl(f.hunt!.url)} accessibilityRole="link">
                  <Text style={[styles.rowText, { color: color.bone }]} numberOfLines={1}>
                    {f.hunt!.name}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {[f.hunt!.agency, f.hunt!.state_code].filter(Boolean).join(' · ')}
                  </Text>
                </Pressable>
                <Pressable
                  hitSlop={10}
                  disabled={togglePermit.isPending}
                  onPress={() => togglePermit.mutate({ permitId: f.permit_id, existingId: f.id })}
                  style={({ pressed }) => pressed && { opacity: 0.5 }}
                  accessibilityLabel="Unfollow permit hunt"
                >
                  <Ionicons name="close" size={15} color={color.dim} />
                </Pressable>
                {i !== arr.length - 1 ? <View style={styles.rowRule} /> : null}
              </View>
            ))}
        </View>
      ) : null}

      {/* One dropdown for all states */}
      <View style={styles.rule} />
      <Serif size={22} style={{ marginBottom: space.x8 }}>
        Add a hunt
      </Serif>
      <Pressable style={styles.dropdown} onPress={() => setDropdownOpen((o) => !o)} accessibilityRole="button">
        <Text style={[styles.rowText, { color: selectedState ? color.bone : color.dim }]}>
          {selectedState ? selectedState.name : 'Choose a state'}
        </Text>
        <Ionicons name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={color.muted} />
      </Pressable>

      {dropdownOpen ? (
        <View>
          {states.map((s, i) => (
            <Pressable
              key={s.id}
              onPress={() => {
                setStateId(s.id);
                setDropdownOpen(false);
              }}
              style={styles.row}
            >
              <Text style={[styles.rowText, { flex: 1, color: stateId === s.id ? color.bone : color.muted }]}>{s.name}</Text>
              {stateId === s.id ? <Ionicons name="checkmark" size={16} color={color.copper} /> : null}
              {i !== states.length - 1 ? <View style={styles.rowRule} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Animals for the chosen state — only what's huntable there, by category */}
      {selectedState ? (
        <View>
          <Sentence style={{ marginTop: space.x16 }}>Which animals in {selectedState.name}?</Sentence>
          {speciesLoading ? (
            <ActivityIndicator color={color.copper} style={{ marginTop: space.x12 }} />
          ) : (
            CATEGORIES.map((cat) => {
              const inCat = stateSpecies.filter((sp) => sp.category === cat.key);
              if (inCat.length === 0) return null;
              return (
                <View key={cat.key}>
                  <Sentence tone="dim" style={{ fontSize: 13, marginTop: space.x16 }}>
                    {cat.label}
                  </Sentence>
                  {inCat.map((sp, i) => {
                    const existingId = followKey.get(`${selectedState.id}:${sp.id}`);
                    const on = Boolean(existingId);
                    return (
                      <Pressable
                        key={sp.id}
                        disabled={toggle.isPending}
                        onPress={() => toggle.mutate({ stateId: selectedState.id, speciesId: sp.id, existingId })}
                        style={({ pressed }) => [styles.row, pressed && { opacity: 0.65 }]}
                      >
                        <SpeciesBadge name={sp.name} size={34} muted={!on} />
                        <Text style={[styles.rowText, { flex: 1, color: on ? color.bone : color.muted }]}>{sp.name}</Text>
                        <Ionicons
                          name={on ? 'checkmark-circle' : 'add'}
                          size={on ? 19 : 17}
                          color={on ? color.copper : color.dim}
                        />
                        {i !== inCat.length - 1 ? <View style={styles.rowRule} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: color.hair, marginHorizontal: -space.gutter, marginVertical: space.section },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.x12, paddingVertical: space.x12, minHeight: 44 },
  rowRule: {
    position: 'absolute',
    left: 46,
    right: -space.gutter,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.hair,
  },
  rowText: { fontFamily: type.ui, fontSize: type.size.body + 0.5 },
  rowSub: { fontFamily: type.ui, fontSize: 13, color: color.muted, marginTop: 2 },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.x12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hair,
  },
  permitTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hair,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
