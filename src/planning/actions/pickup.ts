import { ParcelId } from "../../types.js";
import { ParcelPercept } from "../../percepts.js";

export type PickUp = {
  name: "PickUp";
  parcel: ParcelId;
};

export type PickUpFailure = {
  name: "PickUpFailure";

  // parcels the agent has failed to pick up
  parcelsNotPickedUp: ParcelId[];
};

export type PickUpSuccess = {
  name: "PickUpSuccess";

  // parcels the agent has successfully picked up
  pickedUpParcels: ParcelPercept[];
};
