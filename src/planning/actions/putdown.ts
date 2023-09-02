import { ParcelId } from "../../types.js";
import { ParcelPercept } from "../../percepts.js";

export type PutDown = {
  name: "PutDown";
  // parcel selected by agent to be put down
  parcel: ParcelId;
};

export type PutDownFailure = {
  name: "PutDownFailure";

  // parcels the agent has failed to put down
  parcelsNotPutDown: ParcelId[];
};

export type PutDownSuccess = {
  name: "PutDownSuccess";

  // parcels the agent has successfully to put down
  putDownParcels: ParcelPercept[];
};
