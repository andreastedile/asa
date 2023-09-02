import { Deque } from "@datastructures-js/deque";
import { Commitment } from "./commitment.js";
import PlanExecutor from "../execution/executor.js";
import { Move, MoveFailure, MoveSuccess } from "../planning/actions/actions.js";

type BacktrackingState = {
  name: "backtracking";
  backtracks: Deque<Move>;
};

type AdvancingState = {
  name: "advancing";
  reversed: Deque<Move>;
};

export class BacktrackCommitment implements Commitment {
  #state: AdvancingState | BacktrackingState = {
    name: "advancing",
    reversed: new Deque(),
  };

  #failures = new Deque<Date>();

  /**
   * @param delayMs When backtracking, it is possible to fail to move. In such case, a delay is applied and the same move is retried.
   * @param nTilesToBacktrack Try to backtrack of exactly this number of tiles
   */
  constructor(
    private readonly delayMs: number,
    private readonly nTilesToBacktrack: number,
    private readonly maxNFailures: number,
    private readonly withinMs: number,
  ) {}

  preAction() {
    return;
  }

  // Record a move if the agent is moving forward (= not backtracking)
  postSuccess(success: MoveSuccess, executor: PlanExecutor) {
    switch (this.#state.name) {
      case "advancing": {
        if (this.#state.reversed.size() >= this.nTilesToBacktrack) {
          this.#state.reversed.popBack();
        }

        switch (success.name) {
          case "GoUpSuccess":
            this.#state.reversed.pushFront({ name: "GoDown" });
            break;
          case "GoDownSuccess":
            this.#state.reversed.pushFront({ name: "GoUp" });
            break;
          case "GoLeftSuccess":
            this.#state.reversed.pushFront({ name: "GoRight" });
            break;
          case "GoRightSuccess":
            this.#state.reversed.pushFront({ name: "GoLeft" });
            break;
        }

        break;
      }
      case "backtracking": {
        switch (success.name) {
          case "GoUpSuccess":
            executor.addFront({ name: "GoDown" });
            break;
          case "GoDownSuccess":
            executor.addFront({ name: "GoUp" });
            break;
          case "GoLeftSuccess":
            executor.addFront({ name: "GoRight" });
            break;
          case "GoRightSuccess":
            executor.addFront({ name: "GoLeft" });
            break;
        }

        if (this.#state.backtracks.size() > 0) {
          const action = this.#state.backtracks.popFront();
          executor.addFront(action);
        } else {
          console.log("Backtrack completed. Resume original plan.");
          this.#state = { name: "advancing", reversed: new Deque() };
        }

        break;
      }
    }
  }

  postFailure(failure: MoveFailure, executor: PlanExecutor) {
    this.#failures.pushBack(new Date());

    const now = Date.now();
    while (this.#failures.size() > 0 && now - this.#failures.front().getTime() > this.withinMs) {
      this.#failures.popFront();
    }
    if (this.#failures.size() >= this.maxNFailures) {
      console.log(`${this.#failures.size()} have occurred in the last ${this.withinMs} ms`);
      return;
    }

    switch (this.#state.name) {
      case "advancing": {
        switch (failure.name) {
          case "GoUpFailure": {
            executor.addFront({ name: "GoUp" });
            break;
          }
          case "GoDownFailure": {
            executor.addFront({ name: "GoDown" });
            break;
          }
          case "GoLeftFailure": {
            executor.addFront({ name: "GoLeft" });
            break;
          }
          case "GoRightFailure": {
            executor.addFront({ name: "GoRight" });
            break;
          }
        }

        if (this.#state.reversed.size() > 0) {
          console.log(`Failure while advancing. Start backtrack.`);

          this.#state = {
            name: "backtracking",
            backtracks: this.#state.reversed,
          };

          const action = this.#state.backtracks.popFront();
          executor.addFront(action);
        } else {
          console.log(
            `Failure while advancing. Cannot backtrack, there are no moves. Wait ${this.delayMs} ms and retry failed movement.`,
          );
          executor.addFront({ name: "Wait", ms: this.delayMs });
        }

        executor.resume();
        break;
      }
      case "backtracking": {
        console.log(`Failure while backtracking. Wait ${this.delayMs} ms and retry failed movement.`);

        switch (failure.name) {
          case "GoUpFailure":
            executor.addFront({ name: "GoUp" });
            executor.addFront({ name: "Wait", ms: this.delayMs });
            break;
          case "GoDownFailure":
            executor.addFront({ name: "GoDown" });
            executor.addFront({ name: "Wait", ms: this.delayMs });
            break;
          case "GoLeftFailure":
            executor.addFront({ name: "GoLeft" });
            executor.addFront({ name: "Wait", ms: this.delayMs });
            break;
          case "GoRightFailure":
            executor.addFront({ name: "GoRight" });
            executor.addFront({ name: "Wait", ms: this.delayMs });
            break;
        }

        executor.resume();
        break;
      }
    }
  }
}
