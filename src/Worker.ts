import * as Job from "Job";
import { Operation } from "./Operation";
import { Work } from "./Work";
import u from "./Utility";
import { log } from './ScrupsLogger';

export default class Worker implements Work {

  readonly creep: Creep;
  private _job: Job.Model | undefined;

  static fromMemory(memory: WorkerMemory): Worker | undefined {
    const worker: Creep | null = Game.getObjectById(memory.worker);
    if (!worker) {
      return undefined;
    }

    const job = memory.job ? Job.factory.build(memory.job) : undefined;
    //log.debug(`${worker}: ${memory.job} => ${job}`)
    return new Worker(worker, job);
  }

  toMemory(): WorkerMemory {
    const memory = <WorkerMemory>{
      worker: this.creep.id,
      job: this._job ? this._job.id() : undefined,
    };
    return memory;
  }

  constructor(worker: Creep, job?: Job.Model) {
    this.creep = worker;
    this._job = job;

    if (job) {
      if (job.completion(worker) < 1.0) {
        //log.debug(`${this}: ${job.id()} in progress by ${worker.id}`);
        worker.setJob(job.id());
      }
      else {
        log.debug(`${this}: ${job.id()} completed by ${worker}`);
        this._job = undefined;
        worker.setJob(undefined);
        worker.setLastJob(job);
      }
    }
    else {
      worker.setJob(undefined);
    }
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
    this._job = job;
    //log.debug(`${this}: assigning job ${job}`);
    this.creep.setJob(this._job.id());
  }
}
