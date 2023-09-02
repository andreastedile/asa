import { Commitment } from "./commitment.js";
import { MoveFailure } from "../planning/actions/actions.js";
import PlanExecutor from "../execution/executor.js";

export class MaxConsecutiveFailuresCommitment implements Commitment {
  #nConsecutiveFailuresSoFar = 0;

  /**
   * @param maxConsecutiveFailures Any non-negative value. With 0, it stops the plan at the first failure. A huge value enables blind commitment.
   */
  constructor(private maxConsecutiveFailures: number) {}

  preAction(): void {
    return;
  }

  postSuccess() {
    this.#nConsecutiveFailuresSoFar = 0;
  }

  postFailure(failure: MoveFailure, executor: PlanExecutor): void {
    this.#nConsecutiveFailuresSoFar += 1;

    if (this.#nConsecutiveFailuresSoFar < this.maxConsecutiveFailures) {
      console.log(
        `${this.#nConsecutiveFailuresSoFar} failures so far, ${
          this.maxConsecutiveFailures - this.#nConsecutiveFailuresSoFar
        } possible remaining`,
      );

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

      executor.resume();
    } else {
      console.log(`Reached maximum failures: ${this.maxConsecutiveFailures}`);

      executor.stop(false);
    }
  }
}
