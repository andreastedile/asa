import { Action, ActionFailure, ActionSuccess } from "../planning/actions/actions.js";

export interface Commitment {
  handlePre(action: Action): void;

  postSuccess(success: ActionSuccess): void;

  postFailure(failure: ActionFailure): void;
}
