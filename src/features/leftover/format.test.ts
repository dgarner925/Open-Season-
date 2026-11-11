import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clock12,
  clockLabel,
  isUsDst,
  residencyNote,
  saleClock,
  saleStatus,
  saleTypeLabel,
  upcomingSales,
  type SaleShape,
} from './format';

function sale(over: Partial<SaleShape> = {}): SaleShape {
  return {
    sale_start_date: '2027-07-01',
    sale_start_time: '10:00:00',
    sale_end_date: null,
    time_zone: 'America/Denver',
    residency: ['resident', 'nonresident'],
    sale_type: 'leftover',
    ...over,
  };
}

describe('isUsDst', () => {
  // 2027: second Sunday in March is the 14th, first Sunday in November the 7th.
  it('is standard time the day before it starts', () => {
    expect(isUsDst('2027-03-13')).toBe(false);
  });
  it('is daylight time on the day it starts', () => {
    expect(isUsDst('2027-03-14')).toBe(true);
  });
  it('is daylight time the day before it ends', () => {
    expect(isUsDst('2027-11-06')).toBe(true);
  });
  it('is standard time on the day it ends', () => {
    expect(isUsDst('2027-11-07')).toBe(false);
  });

  // 2026 moves both boundaries, which is the point of computing them.
  it('finds a different boundary in a different year', () => {
    expect(isUsDst('2026-03-07')).toBe(false);
    expect(isUsDst('2026-03-08')).toBe(true);
    expect(isUsDst('2026-10-31')).toBe(true);
    expect(isUsDst('2026-11-01')).toBe(false);
  });

  it('is standard in deep winter and daylight in high summer', () => {
    expect(isUsDst('2027-01-15')).toBe(false);
    expect(isUsDst('2027-12-25')).toBe(false);
    expect(isUsDst('2027-07-04')).toBe(true);
    expect(isUsDst('2027-04-01')).toBe(true);
    expect(isUsDst('2027-10-31')).toBe(true);
  });

  it('says no rather than throwing on a date it cannot read', () => {
    expect(isUsDst('')).toBe(false);
    expect(isUsDst('not-a-date')).toBe(false);
  });
});

describe('clockLabel', () => {
  it('names the agency clock in summer and winter', () => {
    expect(clockLabel('2027-07-01', 'America/Denver')).toBe('MDT');
    expect(clockLabel('2027-01-15', 'America/Denver')).toBe('MST');
    expect(clockLabel('2027-07-01', 'America/New_York')).toBe('EDT');
    expect(clockLabel('2027-01-15', 'America/Chicago')).toBe('CST');
    expect(clockLabel('2027-07-01', 'America/Los_Angeles')).toBe('PDT');
    expect(clockLabel('2027-12-25', 'America/Anchorage')).toBe('AKST');
  });

  it('never moves the clocks in Arizona or Hawaii', () => {
    expect(clockLabel('2027-07-04', 'America/Phoenix')).toBe('MST');
    expect(clockLabel('2027-01-15', 'America/Phoenix')).toBe('MST');
    expect(clockLabel('2027-07-04', 'Pacific/Honolulu')).toBe('HST');
  });

  it('says nothing rather than printing a raw IANA name', () => {
    expect(clockLabel('2027-07-01', 'Europe/Paris')).toBe('');
    expect(clockLabel('2027-07-01', null)).toBe('');
    expect(clockLabel('2027-07-01', '')).toBe('');
  });
});

describe('clock12', () => {
  it('reads a 24-hour time the way an agency prints it', () => {
    expect(clock12('10:00:00')).toBe('10:00 AM');
    expect(clock12('08:30:00')).toBe('8:30 AM');
    expect(clock12('13:05:00')).toBe('1:05 PM');
    expect(clock12('23:59:00')).toBe('11:59 PM');
    expect(clock12('09:00')).toBe('9:00 AM');
  });

  it('gets both ends of the day right', () => {
    expect(clock12('00:30:00')).toBe('12:30 AM');
    expect(clock12('12:00:00')).toBe('12:00 PM');
    expect(clock12('00:00:00')).toBe('12:00 AM');
  });

  it('is empty for no time at all', () => {
    expect(clock12(null)).toBe('');
    expect(clock12('')).toBe('');
    expect(clock12('half past ten')).toBe('');
    expect(clock12('25:00:00')).toBe('');
  });
});

describe('saleClock', () => {
  it('gives the day, the hour and the zone', () => {
    expect(saleClock(sale())).toBe('Jul 1 at 10:00 AM MDT');
  });

  it('gives the day alone when the agency published no hour', () => {
    expect(saleClock(sale({ sale_start_time: null }))).toBe('Jul 1');
  });

  it('drops the zone it cannot name rather than the hour', () => {
    expect(saleClock(sale({ time_zone: 'Europe/Paris' }))).toBe('Jul 1 at 10:00 AM');
    expect(saleClock(sale({ time_zone: null }))).toBe('Jul 1 at 10:00 AM');
  });

  it('labels a March sale by its own date, not by today', () => {
    expect(saleClock(sale({ sale_start_date: '2027-03-15' }))).toBe('Mar 15 at 10:00 AM MDT');
    expect(saleClock(sale({ sale_start_date: '2027-03-01' }))).toBe('Mar 1 at 10:00 AM MST');
  });
});

describe('residencyNote', () => {
  it('says nothing when a sale is open to everybody', () => {
    expect(residencyNote(['resident', 'nonresident'])).toBeNull();
    expect(residencyNote(null)).toBeNull();
    expect(residencyNote([])).toBeNull();
  });

  it('names the restriction when there is one', () => {
    expect(residencyNote(['resident'])).toBe('Residents only');
    expect(residencyNote(['nonresident'])).toBe('Nonresidents only');
  });
});

describe('saleTypeLabel', () => {
  it('uses the words hunters use', () => {
    expect(saleTypeLabel('leftover')).toBe('Leftover');
    expect(saleTypeLabel('otc')).toBe('Over the counter');
    expect(saleTypeLabel('reissue')).toBe('Reissued');
  });
});

describe('saleStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 5, 20, 9, 0, 0)); // 20 June 2027, local
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts down, and only goes copper inside three days', () => {
    expect(saleStatus(sale({ sale_start_date: '2027-07-01' }))).toEqual({
      label: 'In 11 days',
      urgent: false,
      past: false,
    });
    expect(saleStatus(sale({ sale_start_date: '2027-06-23' }))).toEqual({
      label: 'In 3 days',
      urgent: true,
      past: false,
    });
    expect(saleStatus(sale({ sale_start_date: '2027-06-21' }))).toEqual({
      label: 'Opens tomorrow',
      urgent: true,
      past: false,
    });
  });

  it('is loud on the day', () => {
    expect(saleStatus(sale({ sale_start_date: '2027-06-20' }))).toEqual({
      label: 'On sale today',
      urgent: true,
      past: false,
    });
  });

  it('treats a first-come sale with no end date as over the next day', () => {
    const s = saleStatus(sale({ sale_start_date: '2027-06-19', sale_end_date: null }));
    expect(s.past).toBe(true);
    expect(s.label).toBe('Closed');
  });

  it('keeps a dated window open until its last day', () => {
    expect(saleStatus(sale({ sale_start_date: '2027-06-01', sale_end_date: '2027-06-20' }))).toEqual({
      label: 'On sale now',
      urgent: true,
      past: false,
    });
    expect(saleStatus(sale({ sale_start_date: '2027-06-01', sale_end_date: '2027-06-19' })).past).toBe(
      true,
    );
  });
});

describe('upcomingSales', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 5, 20, 9, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('drops what is finished and puts the soonest first', () => {
    const rows = [
      sale({ sale_start_date: '2027-08-01' }),
      sale({ sale_start_date: '2027-06-01' }), // over, no end date
      sale({ sale_start_date: '2027-06-25' }),
      sale({ sale_start_date: '2027-06-20' }),
    ];
    expect(upcomingSales(rows).map((s) => s.sale_start_date)).toEqual([
      '2027-06-20',
      '2027-06-25',
      '2027-08-01',
    ]);
  });
});
