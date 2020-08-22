import * as Job from "Job";
import { Operation } from "./Operation";
import { Work } from "./Work";
import u from "./Utility";
import { log } from './ScrupsLogger';

export default class Worker implements Work {

  readonly creep: Creep;
  private _job: Job.Model | undefined;

  constructor(worker: Creep) {
    this.creep = worker;
    this._job = undefined;
    worker._worker = this;
  }

  id(): string {
    return `worker-${this.creep.id}-${this._job ? this._job.id() : undefined}`;
  }

  toString(): string {
    return this.id();
  }

  hasJob(): boolean {
    return this._job ? true : false;
  }

  job(): Job.Model | undefined {
    return this._job;
  }

  priority(): number {
    return this._job?.priority([this.creep]) ?? 0.0;
  }

  work(): Operation[] {
    if (!this._job) {
      return [];
    }
    return this._job.work(this.creep);
  }

  assignJob(job: Job.Model) {
    this.creep.setJob(this._job);
    this._job = job;
  }
}
