import { beforeEach, describe, expect, test } from 'vitest';
import { FakePlayer } from '../player/fake';
import type { Section } from '../lesson/model';
import { LoopEngine } from './engine';

const section: Section = { id: 's1', name: 'Riff', start: 10, end: 20, rate: 0.75 };

let player: FakePlayer;
let clock: number;
let engine: LoopEngine;

beforeEach(() => {
  player = new FakePlayer();
  clock = 1_000;
  engine = new LoopEngine(player, () => clock);
});

describe('activate', () => {
  test('sets rate, seeks to start, plays, and records the section', () => {
    engine.activate(section);
    expect(player.calls).toEqual(['rate:0.75', 'seek:10', 'play']);
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
