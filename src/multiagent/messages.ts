import { AgentPercept, ParcelPercept } from "../percepts.js";
import { Position } from "../types.js";

export type Register = {
  name: "register";
};

export type Ack = {
  name: "ack";
};

export type AgentPerceptsExchange = {
  name: "agentperceptsexchange";
  percepts: AgentPercept[];
};

export type ParcelPerceptsExchange = {
  name: "parcelperceptsexchange";
  percepts: ParcelPercept[];
};

export type Reserve = {
  name: "reserve";
  tiles: Position[];
  // https://socket.io/docs/v4/emitting-events/#basic-emit
  // Date objects will be converted to (and received as) their string representation, e.g. 1970-01-01T00:00:00.000Z
  timeMs: number;
};

export type Accept = {
  name: "accept";
};

export type Reject = {
  name: "reject";
};

export type Release = {
  name: "release";
  tiles: Position[];
};

export type Reply = Accept | Reject;

export type Message = Register | Ack | AgentPerceptsExchange | ParcelPerceptsExchange | Reserve | Release;
