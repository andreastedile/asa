import { Intention } from "./intentions.js";

export type Deliberate = {
  name: "deliberate";
};

export type Plan = {
  name: "plan";
  intention: Intention;
};

export type Execute = {
  name: "execute";
  intention: Intention;
};

export type Preempt = {
  name: "preempt";
  intention: Intention;
};

export type State = Deliberate | Plan | Execute | Preempt;
