import graphology from "graphology";
import { Edge, Tile, TileMap } from "../graph/graph.js";
import { Deque } from "@datastructures-js/deque";
import { Action } from "./actions/actions.js";
import { bidirectional, edgePathFromNodePath } from "graphology-shortest-path";
import { Planner } from "./planner.js";
import { Intention } from "../intentions.js";

class StandardPlanner implements Planner {
  plan(intention: Intention, graph: graphology.DirectedGraph<Tile, Edge, TileMap>): Promise<Deque<Action>> {
    const copy = graph.copy();

    const me = copy.getAttribute("me");

    const reserved = graph.getAttribute("reserved");
    const occupied = graph
      .filterNodes((node, tile) => tile.agent && tile.agent.id != me.id)
      .map((node) => graph.getNodeAttribute(node, "position"));

    reserved.forEach((position) => copy.dropNode(position));
    occupied.filter((position) => copy.hasNode(position)).forEach((position) => copy.dropNode(position));

    switch (intention.name) {
      case "Deliver": {
        const meToParcelNodePath = bidirectional(copy, me.position, intention.parcel.position);
        if (meToParcelNodePath == null) {
          return Promise.reject(`${intention.parcel.position} is unreachable`);
        }

        const parcelToDestinationNodePath = bidirectional(
          copy,
          intention.parcel.position,
          intention.destination.position,
        );
        if (parcelToDestinationNodePath == null) {
          return Promise.reject(`${intention.destination.position} is unreachable`);
        }

        const plan = new Deque<Action>();

        edgePathFromNodePath(copy, meToParcelNodePath)
          .map((edge) => {
            const adjacency = copy.getEdgeAttribute(edge, "adjacency");

            switch (adjacency) {
              case "up":
                return { name: "GoUp" } as Action;
              case "down":
                return { name: "GoDown" } as Action;
              case "left":
                return { name: "GoLeft" } as Action;
              case "right":
                return { name: "GoRight" } as Action;
            }
          })
          .forEach((action) => plan.pushBack(action));

        // If we are already holding the parcel, do not pick it up, or we encounter a failure
        if (!copy.getNodeAttribute(me.position, "parcels").some((parcel) => intention.parcel.id == parcel.id)) {
          plan.pushBack({
            name: "PickUp",
            parcel: intention.parcel.id,
          });
        }

        edgePathFromNodePath(copy, parcelToDestinationNodePath)
          .map((edge) => {
            const adjacency = copy.getEdgeAttribute(edge, "adjacency");

            switch (adjacency) {
              case "up":
                return { name: "GoUp" } as Action;
              case "down":
                return { name: "GoDown" } as Action;
              case "left":
                return { name: "GoLeft" } as Action;
              case "right":
                return { name: "GoRight" } as Action;
            }
          })
          .forEach((action) => plan.pushBack(action));

        plan.pushBack({
          name: "PutDown",
          parcel: intention.parcel.id,
        });

        return Promise.resolve(plan);
      }
      case "GoTo": {
        const nodePath = bidirectional(copy, me.position, intention.destination);
        if (nodePath == null) {
          return Promise.reject(`${intention.destination} is unreachable`);
        }

        const plan = new Deque<Action>();

        edgePathFromNodePath(copy, nodePath)
          .map((edge) => {
            const adjacency = copy.getEdgeAttribute(edge, "adjacency");

            switch (adjacency) {
              case "up":
                return { name: "GoUp" } as Action;
              case "down":
                return { name: "GoDown" } as Action;
              case "left":
                return { name: "GoLeft" } as Action;
              case "right":
                return { name: "GoRight" } as Action;
            }
          })
          .forEach((action) => plan.pushBack(action));

        return Promise.resolve(plan);
      }
      case "Stay": {
        const plan = new Deque<Action>();
        return Promise.resolve(plan);
      }
    }
  }
}

export default StandardPlanner;
