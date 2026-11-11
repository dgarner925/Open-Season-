import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Share, StyleSheet, View } from 'react-native';
import { LinkSentence, Micro, Rule, Screen, Sentence, Serif } from '@/components/system';
import { ProvenanceBlock } from '@/components/Provenance';
import { ActionRow, LicenseRow } from '@/components/LicenseRow';
import { useSaleAvailability, useSaleById } from '@/features/leftover/queries';
import { clock12, clockLabel, residencyNote, saleClock, saleStatus, saleTypeLabel } from '@/features/leftover/format';
import { addToCalendar } from '@/lib/calendar';
import { openExternalUrl } from '@/lib/openUrl';
import { lang } from '@/theme/tokens';

const { color, space, type } = lang;
const SITE_URL = 'https://osdatesanddraws.com';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function spoken(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  return `${WEEKDAYS[new Date(y, m - 1, d).getDay()]}, ${MONTHS[m - 1]} ${d}`;
}

/**
 * One leftover sale, said plainly.
 *
 * The hierarchy here is not the same as a season's. For a season the date is
 * the headline; for a first-come sale the HOUR is, because the tags are gone
 * by lunchtime and a hunter who knows the day and not the hour has lost
 * nothing less than a hunter who knows neither.
 *
 * When the agency published no hour the screen says so in those words rather
 * than going quiet, because "the hour is not published" is itself the thing
 * you need to know: it means turn up early.
 */
export default function LeftoverSaleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: sale, isLoading } = useSaleById(id);
  const { data: availability = [] } = useSaleAvailability(id);

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={color.copper} style={{ marginTop: space.x38 }} />
      </Screen>
    );
  }
  if (!sale) {
    return (
      <Screen>
        <Sentence tone="bone" style={{ marginTop: space.section }}>
          That tag sale is no longer listed.
        </Sentence>
      </Screen>
    );
  }

  const status = saleStatus(sale);
  const restriction = residencyNote(sale.residency);
  const zonePart = sale.zone?.name && sale.zone.name !== 'Statewide' ? `${sale.zone.name}, ` : '';
  const label = `${sale.state?.code ?? ''} ${sale.name}`.trim();
  const hour = clock12(sale.sale_start_time);
  const zoneLabel = clockLabel(sale.sale_start_date, sale.time_zone);

  const withTags = availability.filter((a) => a.status === 'available');
  const soldOut = availability.filter((a) => a.status === 'sold_out');

  async function onShare() {
    await Share.share({
      message: `${label} — on sale ${saleClock(sale!)}. Tracking it with Open Season. ${SITE_URL}`,
    }).catch(() => {});
  }

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: true, title: '' }} />

      <Serif size={type.size.hero - 10} style={{ marginTop: space.x16, lineHeight: type.size.hero - 4 }}>
        {sale.name}
      </Serif>
      <Sentence style={{ marginTop: space.x8 }}>
        {zonePart}
        {sale.state?.name ?? ''}. {saleTypeLabel(sale.sale_type)} tags
        {restriction ? `, ${restriction.toLowerCase()}` : ''}.
      </Sentence>

      {/* THE SALE — the hour first, because the hour is the thing. */}
      <View style={styles.tile}>
        <Micro>The sale</Micro>

        {hour ? (
          <>
            <Serif size={34} style={{ marginTop: space.x12 }}>
              {hour}
              {zoneLabel ? ` ${zoneLabel}` : ''}
            </Serif>
            <Sentence style={{ marginTop: space.x8 }}>
              {spoken(sale.sale_start_date)}
              {status.label ? (
                <>
                  {' — '}
                  <Serif italic copper size={20}>
                    {status.label.toLowerCase()}
                  </Serif>
                  .
                </>
              ) : (
                '.'
              )}
            </Sentence>
            {zoneLabel ? (
              <Sentence style={{ marginTop: space.x8 }}>
                That is the agency's clock, not your phone's. Check what {zoneLabel} is where you
                are before you set an alarm.
              </Sentence>
            ) : null}
          </>
        ) : (
          <>
            <Serif size={30} style={{ marginTop: space.x12 }}>
              {spoken(sale.sale_start_date)}
            </Serif>
            <Sentence style={{ marginTop: space.x8 }}>
              {sale.state?.name ?? 'The agency'} has not published an hour for this sale. These go
              first come, first served, so treat it as opening at the start of business.
            </Sentence>
          </>
        )}

        {sale.sale_end_date ? (
          <Sentence style={{ marginTop: space.x8 }}>
            Open through {spoken(sale.sale_end_date)}
            {sale.sale_end_time ? ` at ${clock12(sale.sale_end_time)}` : ''}, or until the tags are
            gone.
          </Sentence>
        ) : (
          <Sentence style={{ marginTop: space.x8 }}>
            No closing date is published. First come, first served — in Colorado and Utah that has
            meant minutes.
          </Sentence>
        )}

        {restriction ? (
          <>
            <Rule />
            <Sentence>{restriction}. Check your residency before the day, not on it.</Sentence>
          </>
        ) : null}

        {sale.notes ? (
          <>
            <Rule />
            <Sentence>{sale.notes}</Sentence>
          </>
        ) : null}
      </View>

      {/* What's left, where an agency publishes it. A null count is not zero:
          most states list the units with tags and no numbers at all. */}
      {availability.length > 0 ? (
        <View style={styles.tile}>
          <Micro>What's left</Micro>
          {withTags.length > 0 ? (
            <Sentence style={{ marginTop: space.x12 }}>
              {withTags
                .map((a) =>
                  a.quantity_remaining === null
                    ? a.unit_code ?? 'Statewide'
                    : `${a.unit_code ?? 'Statewide'} (${a.quantity_remaining})`,
                )
                .join(' · ')}
            </Sentence>
          ) : (
            <Sentence style={{ marginTop: space.x12 }}>Nothing showing as available right now.</Sentence>
          )}
          {soldOut.length > 0 ? (
            <Sentence tone="dim" style={{ marginTop: space.x8 }}>
              Sold out: {soldOut.map((a) => a.unit_code ?? 'Statewide').join(' · ')}
            </Sentence>
          ) : null}
          <Sentence tone="dim" style={{ marginTop: space.x12 }}>
            Counts come from the agency's own listing and go stale fast. Treat them as a hint, not
            an inventory.
          </Sentence>
        </View>
      ) : null}

      {sale.purchase_url ? (
        <ActionRow
          icon="open-outline"
          title="Buy on the official site"
          sub="You'll finish on the state's site."
          onPress={() => openExternalUrl(sale.purchase_url)}
        />
      ) : null}
      <LicenseRow stateName={sale.state?.name} url={sale.state?.license_url} />

      <Rule />
      <LinkSentence
        onPress={() =>
          addToCalendar({
            title: `${label} — tags on sale`,
            date: sale.sale_start_date,
            notes: hour ? `Opens ${hour}${zoneLabel ? ` ${zoneLabel}` : ''}.` : undefined,
            url: sale.purchase_url ?? sale.state?.license_url ?? undefined,
          })
        }
      >
        Put the sale in your calendar.
      </LinkSentence>
      <LinkSentence style={{ marginTop: space.x12 }} onPress={onShare}>
        Tell somebody who didn't draw.
      </LinkSentence>

      <ProvenanceBlock
        verifiedAt={sale.last_verified_at}
        agencyName={sale.state?.name ?? null}
        url={sale.source_url}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tile: {
    marginTop: space.x16,
    padding: space.gutter,
    borderRadius: lang.radius.card,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hair,
  },
});
