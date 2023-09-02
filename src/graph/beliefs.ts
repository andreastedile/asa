import { AgentId, ParcelId, Position } from "../types.js";

export type AgentBelief = {
  id: AgentId;
  name: string;
  position: Position;
  score: number;
  date: Date;
  source: "percept" | "decay";
};

export type ParcelBelief = {
  id: ParcelId;
  position: Position;
  reward: number;
  carriedBy?: AgentId;
  date: Date;
  source: "percept" | "decay";
};
