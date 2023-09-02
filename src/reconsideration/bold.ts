import graphology from "graphology";
import { Edge, Tile, TileMap } from "../graph/graph.js";
import { Intention } from "../intentions.js";

export function reconsiderBold(
  graph: graphology.DirectedGraph<Tile, Edge, TileMap>,
  intention: Intention,
): Intention | undefined {
  return;
}
