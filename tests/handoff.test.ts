import { describe, expect, it } from 'vitest';
import { decideHandoff, needsHumanHandoff } from '../src/sales/handoff.js';

const now = new Date('2026-09-18T12:00:00Z');
const hoursFromNow = (h: number) => new Date(now.getTime() + h * 60 * 60 * 1000).toISOString();

describe('needsHumanHandoff', () => {
  it('catches a direct request for a person', () => {
    expect(needsHumanHandoff('can I speak to a human')).toBe(true);
  });

  it('catches the situations a bot should not be handling', () => {
    expect(needsHumanHandoff('I want a refund')).toBe(true);
    expect(needsHumanHandoff('this is fraud')).toBe(true);
  });

  it('leaves an ordinary question alone', () => {
    expect(needsHumanHandoff('what time do you open')).toBe(false);
  });
});

describe('decideHandoff', () => {
  it('replies normally to an ordinary question', () => {
    expect(decideHandoff('what time do you open', null, 24, now)).toEqual({ action: 'reply' });
  });

  it('announces the handover once when it is first asked for', () => {
    const decision = decideHandoff('get me a human', null, 24, now);
    expect(decision.action).toBe('announce');
    expect(decision).toHaveProperty('until', hoursFromNow(24));
  });

  it('stays quiet while a handover is still active, rather than repeating itself', () => {
    expect(decideHandoff('are you there', hoursFromNow(3), 24, now)).toEqual({ action: 'stay_quiet' });
  });

  it('stays quiet on an ordinary question during the window, so the human owns the thread', () => {
    expect(decideHandoff('what time do you open', hoursFromNow(1), 24, now)).toEqual({ action: 'stay_quiet' });
  });

  it('starts answering again once the window has passed', () => {
    // This is the whole point. The old boolean never expired, so the agent was
    // permanently dead for anyone who ever asked for a person.
    expect(decideHandoff('what time do you open', hoursFromNow(-1), 24, now)).toEqual({ action: 'reply' });
  });

  it('can be handed over again after the window expired', () => {
    expect(decideHandoff('human please', hoursFromNow(-1), 24, now).action).toBe('announce');
  });

  it('treats an unparseable timestamp as no handover rather than a permanent one', () => {
    expect(decideHandoff('what time do you open', 'not a date', 24, now)).toEqual({ action: 'reply' });
  });
});
