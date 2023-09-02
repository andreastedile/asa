import { Deliver, Explore } from "../desires.js";
import graphology from "graphology";
import { Edge, Tile, TileMap } from "../graph/graph.js";
import { Position } from "../types.js";
import { bidirectional } from "graphology-shortest-path";
import { ParcelBelief } from "../graph/beliefs.js";

export type DeliverMetadata = {
  readonly parcel: ParcelBelief;
  readonly destination: Tile;
  readonly steps: number; // todo: rename to cost
};

export type ExploreMetadata = {
  readonly destination: Position;
  readonly steps: number; // todo: rename to cost
};

export function rankDeliveryOptions(
  graph: graphology.DirectedGraph<Tile, Edge, TileMap>,
  occupied: Position[],
  reserved: Position[],
  options: Deliver[],
): DeliverMetadata[] {
  const copy = graph.copy();
  occupied.forEach((position) => copy.dropNode(position));
  reserved.filter((position) => copy.hasNode(position)).forEach((position) => copy.dropNode(position));

  const me = copy.getAttribute("me");

  const metadata = options
    .map((option) => {
      const pathFromMeToParcel = bidirectional(copy, me.position, option.parcel.position);
      if (pathFromMeToParcel == null) {
        return undefined;
      }
      const pathFromParcelToDestination = bidirectional(copy, option.parcel.position, option.destination.position);
      if (pathFromParcelToDestination == null) {
        return undefined;
      }
      return {
        parcel: option.parcel,
        destination: option.destination,
        steps: pathFromMeToParcel.length + pathFromParcelToDestination.length - 1,
      } as DeliverMetadata;
    })
    .filter((option) => option != undefined) as DeliverMetadata[];

  // sort from closest to farthest
  return metadata.sort((first, second) => first.steps - second.steps);
}

export function rankExploreOptions(
  graph: graphology.DirectedGraph<Tile, Edge, TileMap>,
  occupied: Position[],
  reserved: Position[],
  options: Explore[],
): ExploreMetadata[] {
  const copy = graph.copy();
  occupied.forEach((position) => copy.dropNode(position));
  reserved.filter((position) => copy.hasNode(position)).forEach((position) => copy.dropNode(position));

  const me = copy.getAttribute("me");

  const metadata = options
    .map((option) => {
      const pathFromMeToDestination = bidirectional(copy, me.position, option.destination);
      if (pathFromMeToDestination == null) {
        return undefined;
      }

      return {
        destination: option.destination,
        steps: pathFromMeToDestination.length,
      } as ExploreMetadata;
    })
    .filter((option) => option != undefined) as ExploreMetadata[];

  // sort from farthest to closest
  return metadata.sort((first, second) => second.steps - first.steps);
}
