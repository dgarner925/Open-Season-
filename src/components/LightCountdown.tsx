/**
 * The living line under the legal-light times: counts down to first light,
 * counts what's left of the day, and after last light hands the hunter
 * tomorrow morning. Copper inside the final hour before first light —
 * the truck-and-coffee minutes (David, 2026-09-14).
 *
 * On-device and offline like the rest of the light machinery; ticks every
 * ten seconds only while mounted.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useLegalLight, type LegalLightToday } from '@/features/legalLight/useLegalLight';
import { fontFamily } from '@/theme';
import { lang } from '@/theme/tokens';

function span(ms: number): { h: number; m: number } {
  const mins = Math.max(0, Math.ceil(ms / 60000));
  return { h: Math.floor(mins / 60), m: mins % 60 };
}

export function LightCountdown({ light, stateCode }: { light: LegalLightToday; stateCode: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  const tomorrow = useLegalLight(stateCode, 1);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  if (!light) return null;

  let text: string;
  let copper = false;
  if (now < light.startMs) {
    const { h, m } = span(light.startMs - now);
    copper = h === 0;
    text = h > 0 ? `First light in ${h}h ${m}m.` : `First light in ${m} ${m === 1 ? 'minute' : 'minutes'}.`;
  } else if (now <= light.endMs) {
    const { h, m } = span(light.endMs - now);
    text = `You are in legal light — ${h > 0 ? `${h}h ${m}m` : `${m} ${m === 1 ? 'minute' : 'minutes'}`} left.`;
  } else {
    text = tomorrow ? `Done for the day. First light tomorrow, ${tomorrow.startClock}.` : 'Done for the day.';
  }

  return <Text style={[styles.line, copper && { color: lang.color.copper }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  line: { fontFamily: fontFamily.serifItalic, fontSize: 17.5, color: lang.color.muted, marginTop: 3 },
});
