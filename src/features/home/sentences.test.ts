import { describe, expect, it } from 'vitest';
import {
  headlineSize,
  lightRuleNote,
  nextOpenerSentence,
  openVerb,
  todaySentence,
  whenPhrase,
} from './sentences';

describe('todaySentence', () => {
  it('says nothing when nothing is open, so the caller can fall back', () => {
    expect(todaySentence([])).toBe('');
    expect(todaySentence(['', '  '])).toBe('');
  });

  it('agrees the verb with a singular species', () => {
    expect(todaySentence(['Deer'])).toBe('Deer is open.');
  });

  it('agrees the verb with a species named as a plural', () => {
    expect(todaySentence(['Ducks'])).toBe('Ducks are open.');
    expect(todaySentence(['Snipe'])).toBe('Snipe are open.');
  });

  it('names both when there are two, lowercasing the second mid-sentence', () => {
    expect(todaySentence(['Deer', 'Black bear'])).toBe('Deer and black bear are open.');
  });

  it('names the first two and counts the rest past that', () => {
    expect(todaySentence(['Deer', 'Black bear', 'Squirrel'])).toBe('Deer, black bear and 1 more are open.');
    expect(todaySentence(['Deer', 'Black bear', 'Squirrel', 'Rabbit', 'Quail'])).toBe(
      'Deer, black bear and 3 more are open.',
    );
  });

  it('ignores blanks when counting, so a missing name never inflates the number', () => {
    expect(todaySentence(['Deer', 'Black bear', '', 'Rabbit'])).toBe('Deer, black bear and 1 more are open.');
  });
});

describe('nextOpenerSentence', () => {
  it('is the sentence Home used to lead with', () => {
    expect(nextOpenerSentence('Bobwhite quail', 6)).toBe('Bobwhite quail opens in 6 days.');
  });

  it('reads naturally at the edges', () => {
    expect(nextOpenerSentence('Deer', 0)).toBe('Deer opens today.');
    expect(nextOpenerSentence('Deer', 1)).toBe('Deer opens tomorrow.');
    expect(nextOpenerSentence('Ducks', 7)).toBe('Ducks open in 7 days.');
  });
});

describe('openVerb and whenPhrase', () => {
  it('keeps the plural list in force', () => {
    expect(openVerb('Geese')).toBe('open');
    expect(openVerb('Turkey')).toBe('opens');
    expect(openVerb(null)).toBe('opens');
  });

  it('never prints a negative countdown', () => {
    expect(whenPhrase(-3)).toBe('today');
  });
});

describe('headlineSize', () => {
  it('holds the big size for a short sentence', () => {
    expect(headlineSize('Deer is open.')).toBe(40);
  });

  it('steps down rather than letting a long sentence run off the screen', () => {
    expect(headlineSize('Deer and black bear are open.')).toBe(34);
    expect(headlineSize('Bobwhite quail, black bear and 3 more are open.')).toBe(28);
  });

  it('steps exactly at the thresholds', () => {
    expect(headlineSize('x'.repeat(24))).toBe(40);
    expect(headlineSize('x'.repeat(25))).toBe(34);
    expect(headlineSize('x'.repeat(42))).toBe(34);
    expect(headlineSize('x'.repeat(43))).toBe(28);
  });
});

describe('lightRuleNote', () => {
  // These are the real rules in src/assets/legal-light.json. A wrong sentence
  // here is a wrong statement about shooting hours, so each state's shape of
  // rule gets a case.
  it('states the common 30/30 rule', () => {
    expect(lightRuleNote(30, 30)).toBe('30 minutes either side of the sun');
  });

  it('states Arizona, where the window is the daylight itself', () => {
    expect(lightRuleNote(0, 0)).toBe('sunrise to sunset');
  });

  it('states Connecticut, which gives the morning but not the evening', () => {
    expect(lightRuleNote(30, 0)).toBe('30 min before sunrise, to sunset');
  });

  it('states an evening-only margin', () => {
    expect(lightRuleNote(0, 30)).toBe('sunrise, to 30 min after sunset');
  });

  it('states an asymmetric rule in full rather than rounding it to one number', () => {
    expect(lightRuleNote(30, 20)).toBe('30 min before sunrise, 20 after sunset');
  });
});
