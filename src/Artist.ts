import { Expert } from "./Expert";
import { Work } from "./Work";
import { Job } from "./Job";
import { JobBuild } from "./JobBuild";
import { Operation } from "./Operation";
import { FunctionCache } from "./Cache";
import u from "./Utility";
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
    if (Memory.control.visualize) {

    }
  }

  schedule(): Job[] {
    return [];
  }

  report(): string[] {
    return [];
  }

  save() {

  }
}
