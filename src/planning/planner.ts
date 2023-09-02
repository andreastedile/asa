import graphology from "graphology";
import { Intention } from "../intentions.js";
import { Edge, Tile, TileMap } from "../graph/graph.js";
import { Deque } from "@datastructures-js/deque";
import { Action } from "./actions/actions.js";
import { Position } from "../types.js";
import {
  getPositionAboveOf,
  getPositionBelowOf,
  getPositionLeftOf,
  getPositionRightOf,
  samePosition,
} from "../position.js";

export interface Planner {
  plan(intention: Intention, graph: graphology.DirectedGraph<Tile, Edge, TileMap>): Promise<Deque<Action>>;
}

export function computeWalkedTiles(graph: graphology.DirectedGraph<Tile, Edge, TileMap>, plan: Action[]) {
  const me = graph.getAttribute("me");

  const positions: Position[] = [me.position];

  for (const action of plan) {
    const curr = positions[positions.length - 1];

    switch (action.name) {
      case "GoUp":
        positions.push(getPositionAboveOf(curr));
        break;
      case "GoDown":
        positions.push(getPositionBelowOf(curr));
        break;
      case "GoLeft":
        positions.push(getPositionLeftOf(curr));
        break;
      case "GoRight":
        positions.push(getPositionRightOf(curr));
        break;
      case "PickUp":
        break;
      case "PutDown":
        break;
      case "Wait":
        break;
    }
  }

  return positions.filter((position, index, self) => {
    return index === self.findIndex((test) => samePosition(position, test));
  });
}
