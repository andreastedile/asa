import { GoUp, GoUpFailure, GoUpSuccess } from "./goup.js";
import { GoDown, GoDownFailure, GoDownSuccess } from "./godown.js";
import { GoLeft, GoLeftFailure, GoLeftSuccess } from "./goleft.js";
import { GoRight, GoRightFailure, GoRightSuccess } from "./goright.js";
import { PickUp, PickUpFailure, PickUpSuccess } from "./pickup.js";
import { PutDown, PutDownFailure, PutDownSuccess } from "./putdown.js";
import { Wait } from "./wait.js";

export type Move = GoUp | GoDown | GoLeft | GoRight | PickUp;
export type Action = Move | PickUp | PutDown | Wait;
export type MoveSuccess = GoUpSuccess | GoDownSuccess | GoLeftSuccess | GoRightSuccess;
export type MoveFailure = GoUpFailure | GoDownFailure | GoLeftFailure | GoRightFailure;
export type ActionSuccess = MoveSuccess | PickUpSuccess | PutDownSuccess;
export type ActionFailure = MoveFailure | PickUpFailure | PutDownFailure;

export function formatAction(action: Action) {
  switch (action.name) {
    case "GoUp":
      return "GoUp";
    case "GoDown":
      return "GoDown";
    case "GoLeft":
      return "GoLeft";
    case "GoRight":
      return "GoRight";
    case "PickUp":
      return `PickUp ${action.parcel}`;
    case "PutDown":
      return `PutDown ${action.parcel}`;
    case "Wait":
      return `Wait ${action.ms} ms`;
  }
}

export function formatSuccess(success: ActionSuccess) {
  switch (success.name) {
    case "GoUpSuccess":
      return "GoUpSuccess";
    case "GoDownSuccess":
      return "GoDownSuccess";
    case "GoLeftSuccess":
      return "GoLeftSuccess";
    case "GoRightSuccess":
      return "GoRightSuccess";
    case "PickUpSuccess":
      return `PickUpSuccess: ${success.pickedUpParcels.map((parcel) => parcel.id).join(", ")}`;
    case "PutDownSuccess":
      return `PutDownSuccess: ${success.putDownParcels.map((parcel) => parcel.id).join(", ")}`;
  }
}

export function formatFailure(failure: ActionFailure) {
  switch (failure.name) {
    case "GoUpFailure":
      return "GoUpFailure";
    case "GoDownFailure":
      return "GoDownFailure";
    case "GoLeftFailure":
      return "GoLeftFailure";
    case "GoRightFailure":
      return "GoRightFailure";
    case "PickUpFailure":
      return `PickUpFailure: ${failure.parcelsNotPickedUp.join(", ")}`;
    case "PutDownFailure":
      return `PutDownFailure: ${failure.parcelsNotPutDown.join(", ")}`;
  }
}
