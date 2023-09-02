import { Position } from "../types.js";
import { Action, Move } from "./actions/actions.js";
import { Planner } from "./planner.js";
import { GoTo } from "../intentions.js";
import graphology from "graphology";
import { Edge, Tile, TileMap } from "../graph/graph.js";
import { Deque } from "@datastructures-js/deque";

function formatPosition(position: Position) {
  return `x${position[0]}y${position[1]}`;
}

function formatNode(node: string) {
  // Split the tuple into two numbers
  const [x, y] = node.split(",");

  return `x${x}y${y}`;
}

function reverseFormat(action: string): Move {
  const regex = /(goup|godown|goleft|goright) x(\d+)y(\d+)/;
  const match = action.match(regex);
  if (match) {
    const [, action] = match;
    switch (action) {
      case "goup":
        return { name: "GoUp" };
      case "godown":
        return { name: "GoDown" };
      case "goleft":
        return { name: "GoLeft" };
      case "goright":
        return { name: "GoRight" };
    }
  }
  throw new Error("Cannot match");
}

export class PDDLPlanner implements Planner {
  static DOMAIN = `(define (domain deliveroo)
    (:requirements :strips)

    (:predicates
        (agent-on ?x)
        (occupied ?x)
    (right-of ?x ?y) ; x is on the right of y
    (left-of  ?x ?y) ; x is on the left  of y
    (above-of ?x ?y) ; x is above           y
    (below-of ?x ?y) ; x is below           y
    )


    ; https://planning.wiki/ref/pddl/requirements#domain-axioms
    ; https://planning.wiki/ref/pddl/domain#axioms

    (:action goup
        :parameters (?x ?y)

        :precondition (and
            (agent-on ?x)
            (or (above-of ?y ?x) (below-of ?x ?y))
            (not (occupied ?y))
        )

        :effect (agent-on ?y)
    )

    (:action godown
            :parameters (?x ?y)

            :precondition (and
                (agent-on ?x)
                (or (below-of ?y ?x) (above-of ?x ?y))
                (not (occupied ?y))
            )

            :effect (agent-on ?y)
    )

    (:action goleft
                :parameters (?x ?y)

                :precondition (and
                    (agent-on ?x)
                    (or (left-of ?y ?x) (right-of ?x ?y))
                    (not (occupied ?y))
                )

                :effect (agent-on ?y)
    )

    (:action goright
                    :parameters (?x ?y)

                    :precondition (and
                        (agent-on ?x)
                        (or (right-of ?y ?x) (left-of ?x ?y))
                        (not (occupied ?y))
                    )

                    :effect (agent-on ?y)
    )
)`;

  async plan(intention: GoTo, graph: graphology.DirectedGraph<Tile, Edge, TileMap>): Promise<Deque<Action>> {
    const me = graph.getAttribute("me");

    const reserved = graph.getAttribute("reserved");
    const occupied = graph
      .filterNodes((node, tile) => tile.agent && tile.agent.id != me.id)
      .map((node) => graph.getNodeAttribute(node, "position"));

    const problem = `(define (problem default)
    (:domain deliveroo)
    (:objects ${graph
      .nodes()
      .map((node) => formatNode(node))
      .join(" ")})
    (:init 
      (agent-on ${formatPosition(me.position)})
      ${reserved.map((position) => `(occupied ${formatPosition(position)})`).join("\n")}
      ${occupied.map((position) => `(occupied ${formatPosition(position)})`).join("\n")}
      ${graph
        .mapDirectedEdges((edge, attr, source, target) => {
          switch (attr.adjacency) {
            case "up":
              return `(above-of ${formatNode(target)} ${formatNode(source)})`;
            case "down":
              return `(below-of ${formatNode(target)} ${formatNode(source)})`;
            case "left":
              return `(left-of ${formatNode(target)} ${formatNode(source)})`;
            case "right":
              return `(right-of ${formatNode(target)} ${formatNode(source)})`;
          }
        })
        .join("\n")})
    (:goal (and (agent-on ${formatPosition(intention.destination)})))
)`;

    // console.log("PDDL problem:");
    // console.log(problem);

    const res = await fetch("http://solver.planning.domains/solve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ domain: PDDLPlanner.DOMAIN, problem }),
    });

    if (res.status != 200) {
      return Promise.reject(`Error at http://solver.planning.domains/solve: ${await res.text()}`);
    }

    const json = await res.json();

    if (json.status == "error") {
      return Promise.reject(`No shortest path from ${me.position} to ${intention.destination}`);
    } else if (json.result.plan) {
      console.log("PDDL plan found:");
      for (const action of json.result.plan) {
        console.log(action.name);
      }

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const plan: Deque<Action> = new Deque(json.result.plan.map((action) => reverseFormat(action.name)));
      return Promise.resolve(plan);
    }

    return Promise.reject("Unimplemented");
  }
}
