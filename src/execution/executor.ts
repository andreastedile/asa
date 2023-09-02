import { Deque } from "@datastructures-js/deque";
import { setTimeout } from "timers/promises";
import chalk from "chalk";
import { Action, formatAction } from "../planning/actions/actions.js";
import { Commitment } from "./commitment.js";
import { DeliverooApi } from "../api.js";

export default class PlanExecutor {
  #stopped = false;
  #success = false;
  #plan = new Deque<Action>();
  #fired = false;

  /**
   * @param api
   */
  constructor(private readonly api: DeliverooApi) {}

  /**
   * @param plan Deque of actions to be executed (from first to last).
   * @return true if the executor has successfully executed all actions in the plan.
   */
  async execute(plan: Deque<Action>, commitment: Commitment): Promise<boolean> {
    this.#stopped = false;
    this.#success = false;
    this.#plan.clear();
    plan.toArray().forEach((action) => this.#plan.pushBack(action));

    return this.start(commitment);
  }

  /**
   * Resume the commitment of a stopped plan.
   */
  resume() {
    this.#stopped = false;
  }

  addFront(action: Action) {
    this.#plan.pushFront(action);
    this.#stopped = false;
  }

  /**
   * Stop the commitment of the plan and clears the deque of actions.
   */
  stop(success: boolean) {
    this.#stopped = true;
    this.#success = success;
    this.#plan.clear();
  }

  printRemainingActions() {
    console.log(
      chalk.dim(
        `Remaining actions: ${this.#plan
          .toArray()
          .map((action) => formatAction(action))
          .join(", ")}`,
      ),
    );
  }

  private async start(commitment: Commitment): Promise<boolean> {
    while (!this.#stopped) {
      const action = this.#plan.popFront();

      if (action) {
        commitment.handlePre(action);

        this.#fired = true;

        switch (action.name) {
          case "GoUp": {
            const moved = await this.api.moveUp();

            this.#fired = false;

            if (moved) {
              commitment.postSuccess({ name: "GoUpSuccess" });
            } else {
              this.#stopped = true;

              commitment.postFailure({ name: "GoUpFailure" });
            }

            break;
          }
          case "GoDown": {
            const moved = await this.api.moveDown();

            this.#fired = false;

            if (moved) {
              commitment.postSuccess({ name: "GoDownSuccess" });
            } else {
              this.#stopped = true;

              commitment.postFailure({ name: "GoDownFailure" });
            }

            break;
          }
          case "GoLeft": {
            const moved = await this.api.moveLeft();

            this.#fired = false;

            if (moved) {
              commitment.postSuccess({ name: "GoLeftSuccess" });
            } else {
              this.#stopped = true;

              commitment.postFailure({ name: "GoLeftFailure" });
            }

            break;
          }
          case "GoRight": {
            const moved = await this.api.moveRight();

            this.#fired = false;

            if (moved) {
              commitment.postSuccess({ name: "GoRightSuccess" });
            } else {
              this.#stopped = true;

              commitment.postFailure({ name: "GoRightFailure" });
            }

            break;
          }
          case "PickUp": {
            const pickedUpParcels = await this.api.pickup();

            this.#fired = false;

            if (pickedUpParcels.some((parcel) => action.parcel == parcel.id)) {
              commitment.postSuccess({ name: "PickUpSuccess", pickedUpParcels });
            } else {
              this.#stopped = true;

              commitment.postFailure({ name: "PickUpFailure", parcelsNotPickedUp: [action.parcel] });
            }

            break;
          }
          case "PutDown": {
            const putDownParcels = await this.api.putdown([action.parcel]);

            this.#fired = false;

            if (putDownParcels.some((parcel) => action.parcel == parcel.id)) {
              commitment.postSuccess({ name: "PutDownSuccess", putDownParcels });
            } else {
              this.#stopped = true;

              commitment.postFailure({
                name: "PutDownFailure",
                parcelsNotPutDown: [action.parcel],
              });
            }

            break;
          }
          case "Wait": {
            await setTimeout(action.ms);

            this.#fired = false;

            break;
          }
        }
      } else {
        // No more actions to execute
        this.#stopped = true;
        this.#success = true;
      }
    }

    return Promise.resolve(this.#success);
  }
}
