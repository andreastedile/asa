import EventEmitter from "events";
import { io, Socket } from "socket.io-client";
import { AgentPercept, MapPercept, ParcelPercept } from "./percepts.js";
import graphology from "graphology";
import { Edge, initGraph, Tile, TileMap } from "./graph/graph.js";
import { AgentId, Config, ParcelId, Position } from "./types.js";
import { Message, Reply, Reserve } from "./multiagent/messages.js";

export class DeliverooApi extends EventEmitter {
  socket: Socket;

  constructor(host: string, token: string) {
    super();

    this.socket = io(host, {
      extraHeaders: {
        "x-token": token,
      },
    });
  }

  async move(direction: "up" | "down" | "left" | "right"): Promise<boolean> {
    switch (direction) {
      case "up":
        return this.moveUp();
      case "down":
        return this.moveDown();
      case "left":
        return this.moveLeft();
      case "right":
        return this.moveRight();
    }
  }

  async moveUp(): Promise<boolean> {
    return new Promise((resolve) => {
      this.socket.emit("move", "up", async (status: boolean) => resolve(status));
    });
  }

  async moveDown(): Promise<boolean> {
    return new Promise((resolve) => {
      this.socket.emit("move", "down", async (status: boolean) => resolve(status));
    });
  }

  async moveLeft(): Promise<boolean> {
    return new Promise((resolve) => {
      this.socket.emit("move", "left", async (status: boolean) => resolve(status));
    });
  }

  async moveRight(): Promise<boolean> {
    return new Promise((resolve) => {
      this.socket.emit("move", "right", async (status: boolean) => resolve(status));
    });
  }

  async pickup(): Promise<{ id: ParcelId; position: Position; reward: number; carriedBy?: AgentId }[]> {
    return new Promise((resolve) => {
      this.socket.emit(
        "pickup",
        async (
          picked: {
            id: string;
            x: number;
            y: number;
            reward: number;
            carriedBy?: string;
          }[],
        ) => {
          resolve(
            picked.map((parcel) => ({
              id: parcel.id,
              position: [parcel.x, parcel.y],
              reward: parcel.reward,
              carriedBy: parcel.carriedBy,
            })),
          );
        },
      );
    });
  }

  async putdown(selected: ParcelId[]): Promise<
    {
      id: ParcelId;
      position: Position;
      reward: number;
      carriedBy?: AgentId;
    }[]
  > {
    return new Promise((resolve) => {
      this.socket.emit(
        "putdown",
        selected,
        async (
          placed: {
            id: string;
            x: number;
            y: number;
            reward: number;
            carriedBy?: string;
          }[],
        ) => {
          resolve(
            placed.map((parcel) => ({
              id: parcel.id,
              position: [parcel.x, parcel.y],
              reward: parcel.reward,
              carriedBy: parcel.carriedBy,
            })),
          );
        },
      );
    });
  }

  async tell(to: AgentId, msg: Message): Promise<"successful"> {
    return new Promise((success) => {
      this.socket.emit("say", to, msg, async (status: "successful") => {
        success(status);
      });
    });
  }

  async shout(msg: Message): Promise<"successful"> {
    return new Promise((success) => {
      this.socket.emit("shout", msg, async (status: "successful") => {
        success(status);
      });
    });
  }

  async ask(to: AgentId, msg: Reserve): Promise<Reply> {
    return new Promise((success) => {
      this.socket.emit("ask", to, msg, async (reply: Reply) => {
        success(reply);
      });
    });
  }
}

export function obtainMap(api: DeliverooApi) {
  console.log("obtainMap called");

  return new Promise<MapPercept>((resolve) => {
    console.log("obtainMap called");

    api.socket.once(
      "map",
      (
        width: number,
        height: number,
        tiles: {
          x: number;
          y: number;
          delivery: boolean;
        }[],
      ) => {
        console.log("Resolving map");
        resolve({
          width,
          height,
          tiles: tiles.map((tile) => {
            return {
              position: [tile.x, tile.y],
              type: tile.delivery ? "delivery" : "spawn",
            };
          }),
        });
      },
    );
  });
}

export function obtainParcelDecayInterval(api: DeliverooApi) {
  console.log("obtainParcelDecayInterval called");

  return new Promise<number | void>((resolve) => {
    console.log("obtainParcelDecayInterval executor");

    api.socket.once("config", async (config: { PARCEL_DECADING_INTERVAL: "1s" | "2s" | "5s" | "10s" | "infinite" }) => {
      switch (config.PARCEL_DECADING_INTERVAL) {
        case "1s":
          resolve(1000);
          break;
        case "2s":
          resolve(2000);
          break;
        case "5s":
          resolve(5000);
          break;
        case "10s":
          resolve(10000);
          break;
        case "infinite":
          resolve();
          break;
      }
      console.log("Resolved");
    });
  });
}

export function obtainMe(api: DeliverooApi) {
  console.log("obtainMe called");

  return new Promise<AgentPercept>((resolve) => {
    console.log("obtainMe called");

    api.socket.once("you", async (you: { id: string; name: string; x: number; y: number; score: number }) => {
      resolve({
        id: you.id,
        name: you.name,
        position: [you.x, you.y],
        score: you.score,
      });
    });
  });
}

export function obtainAll(api: DeliverooApi): Promise<{
  config: Config;
  graph: graphology.DirectedGraph<Tile, Edge, TileMap>;
}> {
  return Promise.all([obtainParcelDecayInterval(api), obtainMap(api), obtainMe(api)]).then(([interval, map, me]) => {
    return { config: { parcelDecayIntervalMs: interval || undefined}, graph: initGraph(map.tiles, me) };
  });
}

export function subscribeToAgentPercepts(api: DeliverooApi, callback: (percepts: AgentPercept[]) => void) {
  api.socket.on(
    "agents sensing",
    (
      percepts: {
        id: string;
        name: string;
        x: number;
        y: number;
        score: number;
      }[],
    ) => {
      const mapped = percepts.map((percept) => {
        return {
          id: percept.id,
          name: percept.name,
          position: [percept.x, percept.y],
          score: percept.score,
        } as AgentPercept;
      });
      callback(mapped);
    },
  );
}

export function subscribeToSelfPercepts(api: DeliverooApi, callback: (percept: AgentPercept) => void) {
  api.socket.on("you", (percept: { id: string; name: string; x: number; y: number; score: number }) => {
    callback({
      id: percept.id,
      name: percept.name,
      position: [percept.x, percept.y],
      score: percept.score,
    });
  });
}

export function subscribeToParcelPercepts(api: DeliverooApi, callback: (percepts: ParcelPercept[]) => void) {
  api.socket.on(
    "parcels sensing",
    (
      parcels: {
        id: string;
        x: number;
        y: number;
        reward: number;
        carriedBy?: string;
      }[],
    ) => {
      const mapped = parcels.map((parcel) => {
        return {
          id: parcel.id,
          position: [parcel.x, parcel.y],
          reward: parcel.reward,
          carriedBy: parcel.carriedBy,
        } as ParcelPercept;
      });
      callback(mapped);
    },
  );
}

export function subscribeToPeerMessages(
  api: DeliverooApi,
  callback: (id: AgentId, name: AgentId, message: Message, reply_cb: (reply: Reply) => void | undefined) => void,
) {
  api.socket.on("msg", (id: AgentId, name: AgentId, message: Message, reply_cb: (reply: Reply) => void | undefined) => {
    callback(id, name, message, reply_cb);
  });
}
