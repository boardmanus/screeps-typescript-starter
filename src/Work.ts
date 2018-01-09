import { Operation } from "./Operation";

export interface Work {
  id() : string;
  priority() : number;
  work() : Operation[];
}
