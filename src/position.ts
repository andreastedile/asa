import { Position } from "./types.js";

export function samePosition(v: Position, u: Position) {
  return v[0] == u[0] && v[1] == u[1];
}

export function getPositionAboveOf(position: Position): Position {
  return [position[0], position[1] + 1];
}

export function getPositionBelowOf(position: Position): Position {
  return [position[0], position[1] - 1];
}

export function getPositionLeftOf(position: Position): Position {
  return [position[0] - 1, position[1]];
}

export function getPositionRightOf(position: Position): Position {
  return [position[0] + 1, position[1]];
}

/**
 * @return whether v is above of u
 */
export function isAboveOf(v: Position, u: Position): boolean {
  return v[0] == u[0] && v[1] == u[1] + 1;
}

/**
 * @return whether v is below of u
 */
export function isBelowOf(v: Position, u: Position): boolean {
  return v[0] == u[0] && v[1] == u[1] - 1;
}

/**
 * @return whether v is left of u
 */
export function isLeftOf(v: Position, u: Position): boolean {
  return v[0] == u[0] - 1 && v[1] == u[1];
}

/**
 * @return whether v is right of u
 */
export function isRightOf(v: Position, u: Position): boolean {
  return v[0] == u[0] + 1 && v[1] == u[1];
}

export function cantorPair([x, y]: Position) {
  return ((x + y) * (x + y + 1)) / 2 + y;
}

export function cantorUnpair(z: number): Position {
  const t = Math.floor((-1 + Math.sqrt(1 + 8 * z)) / 2);
  const x = (t * (t + 3)) / 2 - z;
  const y = z - (t * (t + 1)) / 2;
  return [x, y];
}

export function computeFractionalPart([x, y]: Position): Position {
  return [((x * 10) % 10) / 10, ((y * 10) % 10) / 10];
}

export function computeSource([x, y]: Position): Position {
  const [fx, fy] = computeFractionalPart([x, y]);

  if (fx == 0.6) {
    // comes from left, goes to the right
    return [Math.floor(x), y];
  }
  if (fx == 0.4) {
    // comes from right, goes to the left
    return [Math.ceil(x), y];
  }
  if (fy == 0.6) {
    // comes from below, goes above
    return [x, Math.floor(y)];
  }
  if (fy == 0.4) {
    // comes from above, goes below
    return [x, Math.ceil(y)];
  }
  // stationary
  return [x, y];
}

/**
 * @param x must have one decimal point at most.
 * @param y must have one decimal point at most.
 */
export function computeDestination([x, y]: Position): Position {
  const [fx, fy] = computeFractionalPart([x, y]);

  if (fx == 0.6) {
    // comes from left, goes to the right
    return [Math.ceil(x), y];
  }
  if (fx == 0.4) {
    // comes from right, goes to the left
    return [Math.floor(x), y];
  }
  if (fy == 0.6) {
    // comes from below, goes above
    return [x, Math.ceil(y)];
  }
  if (fy == 0.4) {
    // comes from above, goes below
    return [x, Math.floor(y)];
  }
  // stationary
  return [x, y];
}
