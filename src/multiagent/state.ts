import { AgentId, Position } from "../types.js";

export type Disable = {
  name: "disable";
};

export type Join = {
  name: "join";
  timeout: NodeJS.Timeout;
};

export type Ack = {
  name: "ack";
  peerId: AgentId;
  peerName: string;
};

export type Negotiate = {
  name: "negotiate";
  peerId: AgentId;
  peerName: string;
  reservedByMe: Position[];
  date: Date;
};

export type Release = {
  name: "release";
  peerId: AgentId;
  peerName: string;
};

export type CoordiationState = Disable | Join | Ack | Negotiate | Release;
