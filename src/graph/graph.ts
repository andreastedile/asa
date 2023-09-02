import { Position } from "../types.js";
import { AgentBelief, ParcelBelief } from "./beliefs.js";
import { AgentPercept, ParcelPercept } from "../percepts.js";

import {
  computeDestination,
  computeSource,
  isAboveOf,
  isBelowOf,
  isLeftOf,
  isRightOf,
  samePosition,
} from "../position.js";
import graphology from "graphology";
import assert from "node:assert";

export type Tile = {
  position: Position;
  type: "spawn" | "delivery";
  agent?: AgentBelief;
  parcels: ParcelBelief[];
};

export type Edge = {
  adjacency: "up" | "down" | "left" | "right";
};

export type TileMap = {
  me: AgentBelief;
  // tiles reserved by peer agent
  reserved: Position[];
};

export function initGraph(
  tiles: {
    position: Position;
    type: "delivery" | "spawn";
  }[],
  me: AgentPercept,
): graphology.DirectedGraph<Tile, Edge, TileMap> {
  const graph = new graphology.DirectedGraph<Tile, Edge, TileMap>({
    allowSelfLoops: false,
  });

  for (const tile of tiles) {
    graph.addNode(tile.position, {
      position: tile.position,
      type: tile.type,
      parcels: [],
    });
  }

  for (const u of tiles) {
    for (const v of tiles) {
      if (!samePosition(u.position, v.position)) {
        if (isAboveOf(v.position, u.position)) {
          graph.addDirectedEdge(u.position, v.position, {
            adjacency: "up",
          });
        }
        if (isBelowOf(v.position, u.position)) {
          graph.addDirectedEdge(u.position, v.position, {
            adjacency: "down",
          });
        }
        if (isLeftOf(v.position, u.position)) {
          graph.addDirectedEdge(u.position, v.position, {
            adjacency: "left",
          });
        }
        if (isRightOf(v.position, u.position)) {
          graph.addDirectedEdge(u.position, v.position, {
            adjacency: "right",
          });
        }
      }
    }
  }

  const belief: AgentBelief = {
    id: me.id,
    name: me.name,
    position: me.position,
    score: me.score,
    date: new Date(),
    source: "percept",
  };

  graph.setAttribute("me", belief);
  graph.setAttribute("reserved", []);

  graph.setNodeAttribute(me.position, "agent", belief);

  return graph;
}

export function processAgentPercept(graph: graphology.DirectedGraph<Tile, Edge, TileMap>, percept: AgentPercept) {
  const source = computeSource(percept.position);

  const destination = computeDestination(percept.position);

  const belief: AgentBelief = {
    id: percept.id,
    name: percept.name,
    position: destination,
    score: percept.score,
    date: new Date(),
    source: "percept",
  };

  if (percept.id == graph.getAttribute("me").id) {
    graph.setAttribute("me", belief);
  }

  if (!samePosition(source, destination)) {
    graph.removeNodeAttribute(source, "agent");
  }

  graph.setNodeAttribute(destination, "agent", belief);
}

export function processParcelPercept(graph: graphology.DirectedGraph<Tile, Edge, TileMap>, percept: ParcelPercept) {
  const source = computeSource(percept.position);

  const destination = computeDestination(percept.position);

  const belief: ParcelBelief = {
    id: percept.id,
    position: destination,
    reward: percept.reward,
    carriedBy: percept.carriedBy,
    date: new Date(),
    source: "percept",
  };

  if (samePosition(source, destination)) {
    graph.updateNodeAttribute(destination, "parcels", (beliefs) => {
      return beliefs ? [...beliefs.filter((belief) => percept.id != belief.id), belief] : [];
    });
  } else {
    graph.updateNodeAttribute(source, "parcels", (beliefs) => {
      return beliefs ? beliefs.filter((belief) => belief.id != percept.id) : [];
    });

    graph.updateNodeAttribute(destination, "parcels", (beliefs) => {
      return beliefs ? [...beliefs, belief] : [];
    });
  }
}

export function computeLostReward(currentDate: Date, parcelDate: Date, parcelRewardDecayIntervalMs: number) {
  const elapsedTimeMs = currentDate.getTime() - parcelDate.getTime();
  return elapsedTimeMs * parcelRewardDecayIntervalMs;
}

export function decayParcelRewards(graph: graphology.DirectedGraph<Tile, Edge, TileMap>, maxAgeMs: number) {
  const currDate = new Date();

  const mapper = (belief: ParcelBelief): ParcelBelief | undefined => {
    const ageMs = currDate.getTime() - belief.date.getTime();

    if (ageMs <= maxAgeMs) {
      // Parcel belief has been updated recently
      return belief;
    }

    const lostReward = computeLostReward(currDate, belief.date, maxAgeMs);

    const newReward = belief.reward - lostReward;

    if (newReward > 0) {
      return {
        id: belief.id,
        position: belief.position,
        reward: newReward,
        carriedBy: belief.carriedBy,
        date: currDate,
        source: "decay",
      };
    }
  };

  graph.updateEachNodeAttributes((node, attributes) => {
    const parcels = attributes.parcels
      .map((belief) => mapper(belief))
      .filter((belief) => belief != undefined) as ParcelBelief[];

    return {
      agent: attributes.agent,
      parcels,
      position: attributes.position,
      type: attributes.type,
    };
  });
}

export function decayAgents(graph: graphology.DirectedGraph<Tile, Edge, TileMap>, maxAgeMs: number) {
  const me = graph.getAttribute("me");

  const currDate = new Date();

  const mapper = (belief: AgentBelief): AgentBelief | undefined => {
    if (belief.id == me.id) {
      return belief;
    }

    if (currDate.getTime() - belief.date.getTime() < maxAgeMs) {
      // Agent belief has been updated recently
      return belief;
    }
  };

  graph.updateEachNodeAttributes((node, attributes) => {
    return {
      agent: attributes.agent ? mapper(attributes.agent) : undefined,
      parcels: attributes.parcels,
      position: attributes.position,
      type: attributes.type,
    };
  });
}

export function reserveTiles(graph: graphology.DirectedGraph<Tile, Edge, TileMap>, tiles: Position[]) {
  assert(
    tiles.every((position) => !graph.getAttribute("reserved").some((reserved) => samePosition(reserved, position))),
    "Double reservation",
  );

  graph.updateAttribute("reserved", (existing) => {
    if (existing) {
      return [...existing, ...tiles];
    } else {
      return [];
    }
  });
}

export function releaseTiles(graph: graphology.DirectedGraph<Tile, Edge, TileMap>, tiles: Position[]) {
  graph.updateAttribute("reserved", (existing) => {
    if (existing) {
      return existing.filter((existing) => !tiles.some((tile) => samePosition(existing, tile)));
    } else {
      // Todo: throw error
      return [];
    }
  });

  assert(graph.getAttribute("reserved").length == 0, "Not all tiles have been released");
}
