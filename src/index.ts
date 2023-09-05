import {
  DeliverooApi,
  obtainAll,
  subscribeToAgentPercepts,
  subscribeToParcelPercepts,
  subscribeToPeerMessages,
  subscribeToSelfPercepts,
} from "./api.js";
import {
  decayParcelRewards,
  decayAgents,
  processAgentPercept,
  processParcelPercept,
  reserveTiles,
  releaseTiles,
} from "./graph/graph.js";
import { State } from "./state.js";
import { computeWalkedTiles, Planner } from "./planning/planner.js";
import StandardPlanner from "./planning/standardplanner.js";
import {
  Action,
  ActionFailure,
  ActionSuccess,
  formatAction,
  formatFailure,
  formatSuccess,
} from "./planning/actions/actions.js";
import chalk from "chalk";
import { deliberate } from "./deliberation/deliberate.js";
import { printIntention } from "./intentions.js";
import PlanExecutor from "./execution/executor.js";
import { reconsiderBold } from "./reconsideration/bold.js";
import { AgentId, Position } from "./types.js";
import { CoordiationState } from "./multiagent/state.js";
import { AgentPercept, ParcelPercept } from "./percepts.js";
import { Reply, Reserve } from "./multiagent/messages.js";
import { samePosition } from "./position.js";
import { Commitment } from "./commitment/commitment.js";
import { BacktrackCommitment } from "./commitment/backtrack.js";
import { reconsiderCautious } from "./reconsideration/cautious.js";
import { PDDLPlanner } from "./planning/pddlplanner.js";
import { MaxConsecutiveFailuresCommitment } from "./commitment/maxconsecutivefailures.js";

const host = "http://localhost:8080";
const token =
  process.argv[2] ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImRjYmRiOTdiOTllIiwibmFtZSI6IkJLTiIsImlhdCI6MTY4ODMzMzQ4M30.GeLopOJ6qgTFco57P0johhisv-9sOvcroQQSSmEkNCE";

const api = new DeliverooApi(host, token);

const AGENT_DECAY_INTERVAL_MS = 2000;
const ANNOUNCEMENT_INTERVAL_MS = 1000;

const { config, graph } = await obtainAll(api);

let state: State = { name: "deliberate" };

let coordination: CoordiationState = { name: "disable" };

const stdPlanner: Planner = new StandardPlanner();
const pddlPlanner = new PDDLPlanner();

const executor = new PlanExecutor(api);

if (config.parcelDecayIntervalMs) {
  setInterval(() => {
    console.log(chalk.dim("Decay parcel rewards"));
    decayParcelRewards(graph, config.parcelDecayIntervalMs!);
  }, config.parcelDecayIntervalMs);
}

setInterval(() => {
  console.log(chalk.dim("Decay agents"));
  decayAgents(graph, AGENT_DECAY_INTERVAL_MS);
}, AGENT_DECAY_INTERVAL_MS);

async function exchangeAgentPercepts(percepts: AgentPercept[]) {
  if (coordination.name == "ack" || coordination.name == "negotiate" || coordination.name == "release") {
    console.log(chalk.dim(`Send ${percepts.length} agent percepts to ${coordination.peerName}`));
    await api.tell(coordination.peerId, { name: "agentperceptsexchange", percepts });
  }
}

async function exchangeParcelPercepts(percepts: ParcelPercept[]) {
  if (coordination.name == "ack" || coordination.name == "negotiate" || coordination.name == "release") {
    console.log(chalk.dim(`Send ${percepts.length} parcel percepts to ${coordination.peerName}`));
    await api.tell(coordination.peerId, { name: "parcelperceptsexchange", percepts });
  }
}

subscribeToSelfPercepts(api, async (percept) => {
  console.log(chalk.dim("Received self percept"));

  processAgentPercept(graph, percept);

  await exchangeAgentPercepts([percept]);
});

subscribeToAgentPercepts(api, async (percepts) => {
  if (percepts.length == 0) return;

  console.log(chalk.dim(`Received ${percepts.length} agent percepts`));

  percepts.forEach((percept) => processAgentPercept(graph, percept));

  await exchangeAgentPercepts(percepts);

  reconsider();
});

subscribeToParcelPercepts(api, async (percepts) => {
  if (percepts.length == 0) return;

  console.log(chalk.dim(`Received ${percepts.length} parcel percepts`));

  percepts.forEach((percept) => processParcelPercept(graph, percept));

  await exchangeParcelPercepts(percepts);

  reconsider();
});

if (process.argv[3] == "1") {
  coordination = {
    name: "join",
    timeout: setInterval(async () => {
      console.log(chalk.italic.underline("Announce"));
      await api.shout({ name: "register" });
    }, ANNOUNCEMENT_INTERVAL_MS),
  };

  subscribeToPeerMessages(api, async (peerId, peerName, message, reply_cb: ((reply: Reply) => void) | undefined) => {
    switch (message.name) {
      case "register": {
        await onRegister(peerId, peerName);
        break;
      }
      case "ack": {
        await onAck(peerId, peerName);
        break;
      }
      case "agentperceptsexchange": {
        onAgentPerceptsExchange(peerId, peerName, message.percepts);
        break;
      }
      case "parcelperceptsexchange": {
        onParcelPerceptsExchange(peerId, peerName, message.percepts);
        break;
      }
      case "reserve": {
        const reply = onReservation(peerId, peerName, message);
        if (reply_cb) {
          reply_cb(reply);
        } else {
          throw new Error("Reply callback is not defined");
        }
        break;
      }
      case "release": {
        onRelease(peerId, peerName, message.tiles);
        break;
      }
    }
  });
} else {
  bdi();
}

async function onRegister(peerId: AgentId, peerName: string) {
  if (coordination.name == "join") {
    console.log(chalk.italic.underline(`${peerName} has registered. Acknowledge`));
    await api.tell(peerId, { name: "ack" });
  }
}

async function onAck(peerId: AgentId, peerName: string) {
  if (coordination.name == "join") {
    console.log(chalk.italic.underline(`${peerName} has acked`));
    clearInterval(coordination.timeout);
    await api.tell(peerId, { name: "ack" });
    coordination = { name: "ack", peerId, peerName };

    multiAgentBdi(); // todo: fixme?
  }
}

function onAgentPerceptsExchange(peer: AgentId, name: string, percepts: AgentPercept[]) {
  console.log(chalk.italic(`Received ${percepts.length} agent percepts from ${name}`));

  percepts.forEach((percept) => processAgentPercept(graph, percept));

  reconsider();
}

function onParcelPerceptsExchange(peer: AgentId, name: string, percepts: ParcelPercept[]) {
  console.log(chalk.italic(`Received ${percepts.length} parcel percepts from ${name}`));

  percepts.forEach((percept) => processParcelPercept(graph, percept));

  reconsider();
}

function onReservation(peerId: AgentId, peerName: string, reserve: Reserve): Reply {
  console.log(
    chalk.italic.underline(
      `${peerName} is reserving ${reserve.tiles.length} tiles. State: ${state.name}, multi: ${
        coordination.name
      }. ${reserve.tiles.join(", ")}`,
    ),
  );

  switch (coordination.name) {
    case "disable": {
      throw new Error("Received in disable state");
    }
    case "join": {
      throw new Error("Received in join state");
    }
    case "ack": {
      console.log(chalk.italic.underline("Accept"));
      reserveTiles(graph, reserve.tiles);
      return { name: "accept" };
    }
    case "negotiate": {
      if (coordination.reservedByMe.every((mine) => !reserve.tiles.some((other) => samePosition(mine, other)))) {
        console.log(chalk.italic.underline("Accept"));
        reserveTiles(graph, reserve.tiles);
        return { name: "accept" };
      }
      if (reserve.timeMs < coordination.date.getTime()) {
        // They came first
        console.log(chalk.italic.underline("Accept (they come first)"));
        reserveTiles(graph, reserve.tiles);
        return { name: "accept" };
      }
      console.log(chalk.italic.underline("Reject"));
      return { name: "reject" };
    }
    case "release": {
      console.log(chalk.italic.underline("Accept"));
      reserveTiles(graph, reserve.tiles);
      return { name: "accept" };
    }
  }
}

function onRelease(peerId: AgentId, peerName: string, released: Position[]) {
  console.log(chalk.italic.underline(`${peerName} has released ${released.length} tiles: ${released.join(", ")}`));

  switch (coordination.name) {
    case "disable": {
      throw new Error("Called in disable state");
    }
    case "join": {
      throw new Error("Called in join state");
    }
    case "ack": {
      releaseTiles(graph, released);
      break;
    }
    case "negotiate": {
      releaseTiles(graph, released);
      break;
    }
    case "release": {
      releaseTiles(graph, released);
      break;
    }
  }
}

function reconsider() {
  if (state.name == "execute") {
    // const intention = reconsiderBold(graph, state.intention);
    const intention = reconsiderCautious(graph, state.intention);

    if (intention && intention.name != state.intention.name) {
      console.log(chalk.blue(`Reconsider has produced a new intention: ${printIntention(intention)}`));

      executor.stop(true);

      state = { name: "preempt", intention };
    } else {
      console.log(chalk.dim(`Maintain same intention: ${printIntention(state.intention)}`));
    }
  }
}

function printPlan(plan: Action[]) {
  if (plan.length == 0) {
    console.log(chalk.bold("Empty plan"));
  } else {
    console.log(chalk.bold(`Plan: ${plan.map((action) => action.name).join(", ")}`));
  }
}

async function bdi() {
  while (true) {
    await new Promise((res) => setTimeout(res));

    console.log(chalk.bold(`Single agent BDI loop start. State: ${state.name}`));

    if (state.name == "deliberate" || state.name == "preempt") {
      const intention = deliberate(graph);
      console.log(chalk.bold(`Intention: ${printIntention(intention)}`));

      state = { name: "plan", intention };

      let plan;
      try {
        if (state.intention.name == "GoTo") {
          console.log(chalk.dim("Invoke PDDL planner"));
          plan = await pddlPlanner.plan(state.intention, graph);
        } else {
          console.log(chalk.dim("Invoke standard planner"));
          plan = await stdPlanner.plan(state.intention, graph);
        }
      } catch (error) {
        console.log(chalk.bold.red(`Planner failure: ${error}`));

        state = { name: "deliberate" };
        continue;
      }

      printPlan(plan.toArray());

      state = { name: "execute", intention: state.intention };

      const commitment: Commitment = new BacktrackCommitment(1000, 5, 3, 1000);
      // const commitment: Commitment = new MaxConsecutiveFailuresCommitment(10);

      const success = await executor.execute(plan, {
        handlePre(action: Action) {
          console.log(chalk.dim(`onPre(${formatAction(action)})`));

          commitment.preAction(action, executor, graph);
        },
        postSuccess(action: ActionSuccess) {
          console.log(chalk.green(`onSuccess (${formatSuccess(action)})`));

          switch (action.name) {
            case "GoUpSuccess":
            case "GoDownSuccess":
            case "GoLeftSuccess":
            case "GoRightSuccess":
              commitment.postSuccess(action, executor, graph);
              break;
            // There is no need to update the new agent's position here, as we receive the percept first.
            case "PickUpSuccess":
              // There is no need to update the new parcels here, as we receive the percept first.
              break;
            case "PutDownSuccess": {
              // Update the parcels here, as we do NOT receive a percept for it.
              const me = graph.getAttribute("me");
              graph.updateNodeAttribute(me.position, "parcels", (beliefs) => {
                return beliefs
                  ? beliefs.filter((belief) => !action.putDownParcels.some((percept) => belief.id == percept.id))
                  : [];
              });
              break;
            }
          }

          executor.printRemainingActions();
        },
        postFailure(action: ActionFailure) {
          console.log(chalk.red(`onFailure (${formatFailure(action)})`));

          switch (action.name) {
            case "GoUpFailure":
            case "GoDownFailure":
            case "GoLeftFailure":
            case "GoRightFailure":
              commitment.postFailure(action, executor, graph);
              break;
            case "PickUpFailure": {
              const me = graph.getAttribute("me");

              graph.updateNodeAttribute(me.position, "parcels", (beliefs) => {
                return beliefs
                  ? beliefs.filter((belief) => !action.parcelsNotPickedUp.some((id) => belief.id == id))
                  : [];
              });
              executor.stop(false);
              break;
            }
            case "PutDownFailure": {
              const me = graph.getAttribute("me");

              graph.updateNodeAttribute(me.position, "parcels", (beliefs) => {
                return beliefs
                  ? beliefs.filter((belief) => !action.parcelsNotPutDown.some((id) => belief.id == id))
                  : [];
              });
              executor.stop(false);
              break;
            }
          }
        },
      });

      if (success) {
        console.log(chalk.bold.green("Plan successful"));
      } else {
        console.log(chalk.bold.red("Plan failed"));

        // todo: replan?
      }

      state = { name: "deliberate" };
    } else {
      throw new Error("Invalid state");
    }
  }
}

async function multiAgentBdi() {
  while (true) {
    await new Promise((res) => setTimeout(res));

    console.log(chalk.bold(`Multiagent BDI loop start. State: ${state.name}, multi: ${coordination.name}`));

    if ((state.name == "deliberate" || state.name == "preempt") && coordination.name == "ack") {
      const intention = deliberate(graph);
      console.log(chalk.bold(`Intention: ${printIntention(intention)}`));

      state = { name: "plan", intention };

      let plan;
      try {
        plan = await stdPlanner.plan(state.intention, graph);
      } catch (error) {
        console.log(chalk.bold.red(`Planner failure: ${error}`));

        state = { name: "deliberate" };
        coordination = { name: "ack", peerId: coordination.peerId, peerName: coordination.peerName };
        continue;
      }

      printPlan(plan.toArray());

      const date = new Date();
      const reserved = computeWalkedTiles(graph, plan.toArray());

      console.log(
        chalk.italic.underline(`Ask ${coordination.peerName} to reserve ${reserved.length} tiles: ${reserved.join(", ")}`),
      );
      coordination = {
        name: "negotiate",
        date,
        peerId: coordination.peerId,
        peerName: coordination.peerName,
        reservedByMe: reserved,
      };
      const reply = await api.ask(coordination.peerId, { name: "reserve", timeMs: date.getTime(), tiles: reserved });

      switch (reply.name) {
        case "accept": {
          console.log(chalk.italic.underline.green(`${coordination.peerName} has accepted`));

          state = { name: "execute", intention: state.intention };
          break;
        }
        case "reject": {
          console.log(chalk.italic.underline.red(`${coordination.peerName} has rejected`));

          state = { name: "deliberate" };
          coordination = { name: "ack", peerId: coordination.peerId, peerName: coordination.peerName };
          continue;
        }
      }

      const commitment: Commitment = new BacktrackCommitment(1000, 5, 3, 1000);

      const success = await executor.execute(plan, {
        handlePre(action: Action) {
          console.log(chalk.dim(`onPre(${formatAction(action)})`));

          commitment.preAction(action, executor, graph);
        },
        postSuccess(action: ActionSuccess) {
          console.log(chalk.green(`onSuccess (${formatSuccess(action)})`));

          switch (action.name) {
            case "GoUpSuccess":
            case "GoDownSuccess":
            case "GoLeftSuccess":
            case "GoRightSuccess":
              commitment.postSuccess(action, executor, graph);
              break;
            // There is no need to update the new agent's position here, as we receive the percept first.
            case "PickUpSuccess":
              // There is no need to update the new parcels here, as we receive the percept first.
              break;
            case "PutDownSuccess": {
              // Update the parcels here, as we do NOT receive a percept for it.
              const me = graph.getAttribute("me");
              graph.updateNodeAttribute(me.position, "parcels", (beliefs) => {
                return beliefs
                  ? beliefs.filter((belief) => !action.putDownParcels.some((percept) => belief.id == percept.id))
                  : [];
              });
              break;
            }
          }

          executor.printRemainingActions();
        },
        postFailure(action: ActionFailure) {
          console.log(chalk.red(`onFailure (${formatFailure(action)})`));

          switch (action.name) {
            case "GoUpFailure":
            case "GoDownFailure":
            case "GoLeftFailure":
            case "GoRightFailure":
              commitment.postFailure(action, executor, graph);
              break;
            case "PickUpFailure": {
              const me = graph.getAttribute("me");

              graph.updateNodeAttribute(me.position, "parcels", (beliefs) => {
                return beliefs
                  ? beliefs.filter((belief) => !action.parcelsNotPickedUp.some((id) => belief.id == id))
                  : [];
              });
              executor.stop(false);
              break;
            }
            case "PutDownFailure": {
              const me = graph.getAttribute("me");

              graph.updateNodeAttribute(me.position, "parcels", (beliefs) => {
                return beliefs
                  ? beliefs.filter((belief) => !action.parcelsNotPutDown.some((id) => belief.id == id))
                  : [];
              });
              executor.stop(false);
              break;
            }
          }
        },
      });

      if (success) {
        console.log(chalk.bold.green("Plan successful"));
      } else {
        console.log(chalk.bold.red("Plan failed"));

        // todo: replan?
      }

      console.log(
        chalk.italic.underline(`Tell ${coordination.peerName} to release ${reserved.length} tiles: ${reserved.join(", ")}`),
      );
      coordination = { name: "release", peerId: coordination.peerId, peerName: coordination.peerName };
      await api.tell(coordination.peerId, { name: "release", tiles: reserved });

      state = { name: "deliberate" };
      coordination = { name: "ack", peerId: coordination.peerId, peerName: coordination.peerName };
    } else {
      throw new Error("Invalid state");
    }
  }
}
