import * as Job from "Job";
import { Operation } from "./Operation";
import { Work } from "./Work";
import * as Business from "Business";
import u from "./Utility";
import { log } from './ScrupsLogger';
import Boss from 'Boss';


export default class Worker implements Work {

  readonly job: Job.Model;
  private _creeps: Creep[];

  static fromMemory(jobs: Job.Model[], memory: WorkerMemory): Worker | undefined {

    const job = _.find(jobs, (job) => job.id() === memory.job);
    if (!job) {
      return undefined;
    }

    return new Worker(job, u.map_valid_creeps(memory.creeps));
  }

  toMemory(): WorkerMemory {
    const memory = <WorkerMemory>{
      job: this.job.id(),
      creeps: _.map(this._creeps, (creep) => creep.id)
    };
    return memory;
  }

  constructor(job: Job.Model, creeps: Creep[]) {
    this.job = job;
    this._creeps = creeps;
  }

  id(): string {
    return `worker-${this.job.id()}`;
  }

  priority(): number {
    return 0;
  }

  toString(): string {
    return this.id();
  }

  work(): Operation[] {
    // Get all the operations from the work of all creeps.
    return _.flatten(_.map(this._creeps, (creep) => this.job.work(creep)));
  }
}
