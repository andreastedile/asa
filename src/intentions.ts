import { ParcelBelief } from "./graph/beliefs.js";
import { Position } from "./types.js";
import { Tile } from "./graph/graph.js";

export type Deliver = {
  readonly name: "Deliver";
  readonly parcel: ParcelBelief;
  readonly destination: Tile;
};

export type GoTo = {
  readonly name: "GoTo";

  readonly destination: Position;
};

export type Stay = {
  readonly name: "Stay";
};

export type Intention = Deliver | GoTo | Stay;

export function printIntention(intention: Intention) {
  switch (intention.name) {
    case "Deliver":
      return `Deliver ${intention.parcel.position} to ${intention.destination.position}`;
    case "GoTo":
      return `GoTo ${intention.destination}`;
    case "Stay":
      return "Stay";
  }
}
