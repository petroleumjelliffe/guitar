import { beforeEach, describe, expect, test } from 'vitest';
import { FakePlayer } from '../player/fake';
import { FakeClicker } from '../audio/fake';
import type { Section } from '../lesson/model';
import { LoopEngine } from './engine';

const section: Section = { id: 's1', name: 'Riff', start: 10, end: 20 };

let player: FakePlayer;
let clock: number;
let engine: LoopEngine;
let clicker: FakeClicker;

beforeEach(() => {
  player = new FakePlayer();
  clock = 1_000;
  engine = new LoopEngine(player, () => clock);
  clicker = new FakeClicker();
  engine.clicker = clicker;
});

describe('activate', () => {
  test('seeks to start, plays, and records the section (speed is global, not per section)', () => {
    engine.activate(section);
    expect(player.calls).toEqual(['seek:10', 'play']);
    expect(engine.state.section).toEqual(section);
  });
  test('calls onChange', () => {
    let n = 0;
    engine.onChange = () => n++;
    engine.activate(section);
    expect(n).toBe(1);
  });
});

describe('tick without gap', () => {
  beforeEach(() => {
    engine.countIn = 0; // disable count-in fallback for these tests
  });
  test('does nothing when not looping', () => {
    engine.activate(section);
    player.time = 25;
    player.calls = [];
    engine.tick();
    expect(player.calls).toEqual([]);
  });
  test('seeks back to start when looping and past end', () => {
    engine.activate(section);
    engine.toggleLoop();
    player.time = 20.1;
    player.calls = [];
    engine.tick();
    expect(player.calls).toEqual(['seek:10']);
  });
  test('does nothing before end', () => {
    engine.activate(section);
    engine.toggleLoop();
    player.time = 19.9;
    player.calls = [];
    engine.tick();
    expect(player.calls).toEqual([]);
  });
  test('does nothing while paused', () => {
    engine.activate(section);
    engine.toggleLoop();
    player.pause();
    player.time = 25;
    player.calls = [];
    engine.tick();
    expect(player.calls).toEqual([]);
  });
  test('does nothing with no active section', () => {
    engine.toggleLoop();
    player.play();
    player.time = 25;
    player.calls = [];
    engine.tick();
    expect(player.calls).toEqual([]);
  });
});

describe('toggleLoop', () => {
  test('flips and returns the new value', () => {
    expect(engine.toggleLoop()).toBe(true);
    expect(engine.state.looping).toBe(true);
    expect(engine.toggleLoop()).toBe(false);
  });
});

describe('restart', () => {
  test('seeks to start and plays', () => {
    engine.activate(section);
    player.pause();
    player.time = 15;
    player.calls = [];
    engine.restart();
    expect(player.calls).toEqual(['seek:10', 'play']);
  });
  test('is a no-op with no active section', () => {
    engine.restart();
    expect(player.calls).toEqual([]);
  });
});

describe('setSection / deactivate', () => {
  test('setSection replaces boundaries of the active section without seeking', () => {
    engine.activate(section);
    player.calls = [];
    engine.setSection({ ...section, end: 21 });
    expect(engine.state.section?.end).toBe(21);
    expect(player.calls).toEqual([]);
  });
  test('setSection ignores a different section id', () => {
    engine.activate(section);
    engine.setSection({ ...section, id: 'other', end: 21 });
    expect(engine.state.section?.end).toBe(20);
  });
  test('deactivate clears the section but keeps looping', () => {
    engine.activate(section);
    engine.toggleLoop();
    engine.deactivate();
    expect(engine.state.section).toBeNull();
    expect(engine.state.looping).toBe(true);
  });
});

describe('tick with gap', () => {
  test('pauses, seeks to start, then resumes after the gap', () => {
    engine.gap = 2;
    engine.activate(section);
    engine.toggleLoop();
    player.time = 20.2;
    player.calls = [];

    engine.tick();
    expect(player.calls).toEqual(['pause', 'seek:10']);
    expect(engine.state.gapUntil).toBe(3_000);

    clock = 2_500;
    engine.tick();
    expect(player.calls).toEqual(['pause', 'seek:10']); // still waiting

    clock = 3_000;
    engine.tick();
    expect(player.calls).toEqual(['pause', 'seek:10', 'play']);
    expect(engine.state.gapUntil).toBeNull();
  });
  test('restart during the gap clears it and plays', () => {
    engine.gap = 2;
    engine.activate(section);
    engine.toggleLoop();
    player.time = 20.2;
    engine.tick();
    player.calls = [];
    engine.restart();
    expect(player.calls).toEqual(['seek:10', 'play']);
    expect(engine.state.gapUntil).toBeNull();
  });
  test('toggling loop off during the gap clears it', () => {
    engine.gap = 2;
    engine.activate(section);
    engine.toggleLoop();
    player.time = 20.2;
    engine.tick();
    engine.toggleLoop();
    expect(engine.state.gapUntil).toBeNull();
  });
});

describe('seekTo / seekBy', () => {
  test('clamps to [0, duration]', () => {
    engine.seekTo(-5);
    engine.seekTo(999);
    expect(player.calls).toEqual(['seek:0', 'seek:300']);
  });
  test('keeps the section when landing near it', () => {
    engine.activate(section);
    engine.seekTo(9.6);
    engine.seekTo(20.9);
    expect(engine.state.section).not.toBeNull();
  });
  test('deactivates when landing outside [start-0.5, end+1]', () => {
    engine.activate(section);
    engine.seekTo(9.4);
    expect(engine.state.section).toBeNull();
    engine.activate(section);
    engine.seekTo(21.1);
    expect(engine.state.section).toBeNull();
  });
  test('seekBy is relative to the current time', () => {
    player.time = 50;
    engine.seekBy(-3);
    expect(player.time).toBe(47);
  });
});

describe('stepFrame', () => {
  test('moves one frame while paused', () => {
    player.time = 10;
    engine.stepFrame(1);
    expect(player.time).toBeCloseTo(10 + 1 / 30, 6);
    engine.stepFrame(-1);
    engine.stepFrame(-1);
    expect(player.time).toBeCloseTo(10 - 1 / 30, 6);
  });
  test('does nothing while playing', () => {
    player.play();
    player.time = 10;
    player.calls = [];
    engine.stepFrame(1);
    expect(player.calls).toEqual([]);
  });
  test('clamps at 0 and duration', () => {
    player.time = 0;
    engine.stepFrame(-1);
    expect(player.time).toBe(0);
    player.time = 300;
    engine.stepFrame(1);
    expect(player.time).toBe(300);
  });
});

describe('count-in', () => {
  const withTempo = () => { engine.bpm = 120; engine.beatsPerBar = 4; };

  test('at the section end: pauses, seeks to start, schedules one bar of clicks, waits a bar', () => {
    withTempo();
    engine.activate(section);
    engine.toggleLoop();
    player.time = 20.2;
    player.calls = [];
    clicker.calls = [];
    engine.tick();
    expect(player.calls).toEqual(['pause', 'seek:10']);
    expect(clicker.calls).toEqual(['countIn:120:4:4:1000']);
    expect(engine.state.gapUntil).toBe(1000 + 2000); // 4 beats at 120 BPM
    clock = 3000;
    engine.tick();
    expect(player.calls).toEqual(['pause', 'seek:10', 'play']);
  });

  test('runs at bpm × the player\'s current rate and honours countIn bars and beatsPerBar', () => {
    engine.countIn = 2;
    player.r = 0.5;
    withTempo();
    engine.beatsPerBar = 3;
    engine.activate(section);
    engine.toggleLoop();
    player.time = 20.2;
    clicker.calls = [];
    engine.tick();
    expect(clicker.calls).toEqual(['countIn:60:6:3:1000']);
    expect(engine.state.gapUntil).toBe(1000 + 6000); // 6 beats at 60 BPM
  });

  test('falls back to the seconds gap when the lesson has no tempo', () => {
    engine.countIn = 0;
    engine.gap = 2;
    engine.activate(section); // engine.bpm stays 0
    engine.toggleLoop();
    player.time = 20.2;
    clicker.calls = [];
    engine.tick();
    expect(clicker.calls).toEqual([]);
    expect(engine.state.gapUntil).toBe(1000 + 2000);
  });

  test('falls back to the seconds gap when countIn is 0', () => {
    engine.countIn = 0;
    engine.gap = 1;
    withTempo();
    engine.activate(section);
    engine.toggleLoop();
    player.time = 20.2;
    clicker.calls = [];
    engine.tick();
    expect(clicker.calls).toEqual([]);
    expect(engine.state.gapUntil).toBe(2000);
  });

  test('with countIn 0 and gap 0 just seeks', () => {
    engine.countIn = 0;
    withTempo();
    engine.activate(section);
    engine.toggleLoop();
    player.time = 20.2;
    player.calls = [];
    engine.tick();
    expect(player.calls).toEqual(['seek:10']);
  });

  test.each([
    ['restart', () => engine.restart()],
    ['deactivate', () => engine.deactivate()],
    ['toggleLoop off', () => engine.toggleLoop()],
    ['seek away', () => engine.seekTo(100)],
    ['activate another', () => engine.activate({ ...section, id: 'other' })],
  ])('%s during the count-in stops the clicks', (_name, interrupt) => {
    withTempo();
    engine.activate(section);
    engine.toggleLoop();
    player.time = 20.2;
    engine.tick();
    clicker.calls = [];
    interrupt();
    expect(clicker.calls).toEqual(['stop']);
    expect(engine.state.gapUntil).toBeNull();
  });

  test('works without a clicker', () => {
    engine.clicker = null;
    withTempo();
    engine.activate(section);
    engine.toggleLoop();
    player.time = 20.2;
    expect(() => engine.tick()).not.toThrow();
    expect(engine.state.gapUntil).toBe(3000);
  });
});

describe('arm', () => {
  test('activates and loops without touching the player', () => {
    let n = 0;
    engine.onChange = () => n++;
    engine.arm(section);
    expect(player.calls).toEqual([]);
    expect(engine.state.section).toEqual(section);
    expect(engine.state.looping).toBe(true);
    expect(engine.state.gapUntil).toBeNull();
    expect(n).toBe(1);
  });
  test('stops any pending clicks', () => {
    engine.arm(section);
    expect(clicker.calls).toEqual(['stop']);
  });
  test('the next play-through past the end restarts through the normal loop path', () => {
    engine.gap = 1;
    engine.arm(section);
    player.play();
    player.time = 20.5;
    player.calls = [];
    engine.tick();
    expect(player.calls).toEqual(['pause', 'seek:10']);
  });
});

describe('count-in fallback without a tempo', () => {
  test('countIn bars become a silent gap of 2 s per bar', () => {
    engine.countIn = 2;
    engine.gap = 0;
    engine.activate(section);
    engine.toggleLoop();
    player.time = 20.2;
    clicker.calls = [];
    engine.tick();
    expect(clicker.calls).toEqual([]);
    expect(engine.state.gapUntil).toBe(1000 + 4000);
  });
  test('the seconds gap applies only when countIn is 0', () => {
    engine.countIn = 0;
    engine.gap = 3;
    engine.activate(section);
    engine.toggleLoop();
    player.time = 20.2;
    engine.tick();
    expect(engine.state.gapUntil).toBe(1000 + 3000);
  });
});
