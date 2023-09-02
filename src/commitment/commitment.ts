import { Action, MoveFailure, MoveSuccess } from "../planning/actions/actions.js";
import PlanExecutor from "../execution/executor.js";
import graphology from "graphology";
import { Edge, Tile, TileMap } from "../graph/graph.js";

export interface Commitment {
  preAction(action: Action, executor: PlanExecutor, graph: graphology.DirectedGraph<Tile, Edge, TileMap>): void;

  postSuccess(success: MoveSuccess, executor: PlanExecutor, graph: graphology.DirectedGraph<Tile, Edge, TileMap>): void;

  postFailure(failure: MoveFailure, executor: PlanExecutor, graph: graphology.DirectedGraph<Tile, Edge, TileMap>): void;
}
