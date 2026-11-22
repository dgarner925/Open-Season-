/**
 * The Today card's data, live.
 *
 * Two queries rather than one, because they fail independently and the card
 * is built to show whatever came back. A dead USGS does not cost you the
 * sunset; a dead NWS does not cost you the flow.
 *
 * ---------------------------------------------------------------------------
 * NO FAILURE STATE BLANKS THE CARD
 *
 * The brief's requirement, and `useDawnConditions`'s existing habit: show
 * what arrived. So neither query has an error branch the component reads.
 * `fetchGaugeSeries` resolves to an empty series on any failure, which
 * `conditionsFrom` turns into `cfs: null`, which `conditionSentence` turns
 * into "No reading from The Hooch." -- a true sentence, rendered in the same
 * layout, with no pill and no verdict.
 *
 * `isPending` is still exposed, because "we have not asked yet" and "we asked
 * and the river did not answer" are different things and the card should not
 * say the second while the first is true.
 *
 * Fifteen minutes of staleTime for the gauge, as the brief specified. USGS
 * publishes instantaneous values at 15-minute intervals, so a shorter window
 * would re-fetch a 6-9 second request to receive the same number.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchHourlyPeriods } from '@/features/weather/useDawnConditions';
import { almanacFor, conditionsFrom, type GaugeConditions, type OtwAlmanac } from './conditions';
import { gaugeFor, type Gauge } from './gauges';
import { fetchGaugeSeries } from './usgs';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/**
 * One gauge's flow, water temperature and 24-hour history.
 *
 * Retries once. The endpoint is slow rather than flaky, and a second 20-second
 * attempt is the most that is worth making somebody wait before the card
 * settles for saying it has no reading.
 */
export function useGaugeConditions(siteNo: string | null | undefined): {
  conditions: GaugeConditions | null;
  isPending: boolean;
  refetch: () => void;
} {
  const gauge = gaugeFor(siteNo);

  const query = useQuery({
    enabled: !!gauge,
    queryKey: ['otw', 'gauge', gauge?.siteNo],
    queryFn: () => fetchGaugeSeries(gauge!.siteNo),
    staleTime: FIFTEEN_MINUTES,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    retryDelay: 2000,
    refetchOnWindowFocus: false,
  });

  const conditions = useMemo(
    () => (gauge ? conditionsFrom(gauge, query.data) : null),
    [gauge, query.data],
  );

  return { conditions, isPending: query.isPending && !!gauge, refetch: () => void query.refetch() };
}

/**
 * The almanac for a gauge: air and sky from NWS, sun and moon on-device.
 *
 * NWS is called at the GAUGE's coordinates, through the same session-cached
 * `fetchHourlyPeriods` hunting uses. That function was already exported and
 * already takes a LatLng, so On the Water reads the weather without one line
 * changing in `useDawnConditions` -- which is what keeps hunting's dawn row
 * provably untouched.
 *
 * The sun and the moon do not wait on the query: they are computed from the
 * gauge's own latitude and longitude, so the three right-hand columns are
 * correct on the first frame and stay correct with the network off.
 */
export function useOtwAlmanac(gauge: Gauge | null): OtwAlmanac | null {
  const query = useQuery({
    enabled: !!gauge,
    queryKey: ['otw', 'nws', gauge?.siteNo],
    queryFn: () => fetchHourlyPeriods({ lat: gauge!.lat, lng: gauge!.lng }),
    staleTime: FIFTEEN_MINUTES,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Recomputed per hour, not per render: the moon and the sun do not move
  // fast enough to justify new objects on every pass, and the NWS period
  // lookup is keyed to the hour anyway.
  const hourStamp = Math.floor(Date.now() / 3600_000);

  return useMemo(
    () => (gauge ? almanacFor(gauge, new Date(), query.data ?? []) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gauge, query.data, hourStamp],
  );
}
