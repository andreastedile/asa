import graphology from "graphology";
import { Edge, Tile, TileMap } from "../graph/graph.js";
import { Intention } from "../intentions.js";
import { deliberate } from "../deliberation/deliberate.js";

export function reconsiderCautious(
  graph: graphology.DirectedGraph<Tile, Edge, TileMap>,
  current: Intention,
): Intention | undefined {
  switch (current.name) {
    case "Stay":
      return deliberate(graph);
    case "Deliver":
      // Future work: check if there is a better parcel to relocate, maintaining the currently held one
      break;
    case "GoTo":
      return deliberate(graph);
  }
}
