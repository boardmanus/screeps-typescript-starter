import { Expert } from "./Expert";
import * as Job from "Job";
import log from "./ScrupsLogger";

export class Artist implements Expert {

  constructor() {

  }

  id(): string {
    return `artist}`;
  }

  toString(): string {
    return this.id();
  }

  survey(): void {
    log.debug(`${this} surveying...`);

  }

  schedule(): Job.Model[] {
    return [];
  }

  report(): string[] {
    return [];
  }

  save() {

  }
}
