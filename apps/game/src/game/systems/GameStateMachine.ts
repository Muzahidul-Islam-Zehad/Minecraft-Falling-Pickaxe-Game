/**
 * Explicit game state machine (master spec §65):
 * BOOT | LOADING | READY | RUNNING | PAUSED | STOPPED | ERROR
 * Illegal transitions are refused and reported, never silently ignored.
 */
import type { GameState } from "@mef/shared-types";

const ALLOWED: Record<GameState, readonly GameState[]> = {
  BOOT: ["LOADING", "ERROR"],
  LOADING: ["READY", "ERROR"],
  READY: ["RUNNING", "STOPPED", "ERROR"],
  RUNNING: ["PAUSED", "STOPPED", "ERROR"],
  PAUSED: ["RUNNING", "STOPPED", "ERROR"],
  STOPPED: ["LOADING"], // reset flow (§109) restarts the pipeline
  ERROR: ["STOPPED"],
};

export class GameStateMachine {
  private state: GameState = "BOOT";

  private readonly listeners = new Set<(from: GameState, to: GameState) => void>();

  get current(): GameState {
    return this.state;
  }

  is(state: GameState): boolean {
    return this.state === state;
  }

  canTransition(to: GameState): boolean {
    return ALLOWED[this.state].includes(to);
  }

  /**
   * Attempt a transition.
   * @returns true when the transition was legal and applied.
   */
  transition(to: GameState): boolean {
    if (!this.canTransition(to)) {
      return false;
    }
    const from = this.state;
    this.state = to;
    for (const listener of this.listeners) listener(from, to);
    return true;
  }

  /** Force the machine into a state (recovery path; prefer transition). */
  force(to: GameState): void {
    const from = this.state;
    this.state = to;
    for (const listener of this.listeners) listener(from, to);
  }

  /** Subscribe to successful transitions. Returns an unsubscribe function. */
  onChange(listener: (from: GameState, to: GameState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
