import { ParcelBelief } from "./graph/beliefs.js";
import { Tile } from "./graph/graph.js";
import { Position } from "./types.js";

export type Deliver = {
  readonly name: "Deliver";
  readonly parcel: ParcelBelief;
  readonly destination: Tile;
};

export type Wait = {
  readonly name: "Wait";
};

export type Explore = {
  readonly name: "Explore";
  readonly destination: Position;
};

export type Desire = Deliver | Wait | Explore;
