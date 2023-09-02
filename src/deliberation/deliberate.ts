import graphology from "graphology";
import { Edge, Tile, TileMap } from "../graph/graph.js";
import { Intention } from "../intentions.js";
import { rankDeliveryOptions, rankExploreOptions } from "./rank.js";
import { Deliver, Explore } from "../desires.js";
import { samePosition } from "../position.js";

export function deliberate(graph: graphology.DirectedGraph<Tile, Edge, TileMap>): Intention {
  const me = graph.getAttribute("me");

  const reserved = graph.getAttribute("reserved");
  const occupied = graph
    .filterNodes((node, tile) => tile.agent && tile.agent.id != me.id)
    .map((node) => graph.getNodeAttribute(node, "position"));

  console.log(`Reserved tiles: ${reserved.join(", ")}`);
  console.log(`Occupied tiles: ${occupied.join(", ")}`);

  const parcels = graph
    .filterNodes((node, tile) => {
      if (tile.agent && tile.agent.id != me.id) return false; // occupied by someone else
      if (reserved.some((position) => samePosition(tile.position, position))) return false; // reserved to peer agent
      if (tile.parcels.length == 0) return false; // has no parcels
      return true;
    })
    .map((node) => graph.getNodeAttribute(node, "parcels"))
    .flat();

  const freeDeliveryTiles = graph
    .filterNodes((node, tile) => {
      if (tile.type == "spawn") return false; // not a delivery tile
      if (reserved.some((position) => samePosition(tile.position, position))) return false; // reserved to peer agent
      if (tile.agent && tile.agent.id != me.id) return false; // occupied by someone else
      return true;
    })
    .map((node) => graph.getNodeAttributes(node));

  const freeTiles = graph
    .filterNodes((node, tile) => {
      if (tile.agent && tile.agent.id != me.id) return false; // occupied by someone else
      if (reserved.some((position) => samePosition(tile.position, position))) return false; // reserved to peer agent
      return true;
    })
    .map((node) => graph.getNodeAttributes(node));

  const deliveryOptions: Deliver[] = [];
  for (const parcel of parcels) {
    for (const destination of freeDeliveryTiles) {
      deliveryOptions.push({ name: "Deliver", parcel, destination });
    }
  }

  const exploreOptions: Explore[] = [];
  for (const destination of freeTiles) {
    if (!samePosition(me.position, destination.position)) {
      exploreOptions.push({ name: "Explore", destination: destination.position });
    }
  }

  // console.log("Delivery options:");
  // deliveryOptions.forEach((option) => {
  //   console.log(`Parcel: ${option.parcel.position}, destination: ${option.destination.position}`);
  // });

  // console.log("Explore options:");
  // exploreOptions.forEach((option) => {
  //   console.log(`Destination: ${option.destination}`);
  // });

  const rankedDeliveryOptions = rankDeliveryOptions(graph, occupied, reserved, deliveryOptions);
  const rankedExploreOptions = rankExploreOptions(graph, occupied, reserved, exploreOptions);

  // console.log("Ranked delivery options:");
  // rankedDeliveryOptions.forEach((option) => {
  //   console.log(`Parcel: ${option.parcel.position}, destination: ${option.destination.position}, cost: ${option.steps}`);
  // });

  // console.log("Ranked explore options:");
  // rankedExploreOptions.forEach((option) => {
  //   console.log(`Destination: ${option.destination}, cost: ${option.steps}`);
  // });

  if (rankedDeliveryOptions.length > 0) {
    const { parcel, destination } = rankedDeliveryOptions[0];
    return { name: "Deliver", parcel, destination };
  }

  if (rankedExploreOptions.length > 0) {
    const { destination } = rankedExploreOptions[0];
    return { name: "GoTo", destination };
  }

  return { name: "Stay" };
}
