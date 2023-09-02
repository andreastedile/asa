import {AgentId, ParcelId, Position} from "./types.js";

export type AgentPercept = {
    id: AgentId;
    name: string;
    position: Position;
    score: number;
};

export type MapPercept = {
    width: number;
    height: number;
    tiles: {
        position: Position;
        type: "delivery" | "spawn";
    }[];
};

export type ParcelPercept = {
    id: ParcelId;
    position: Position;
    reward: number;
    carriedBy?: AgentId;
};
