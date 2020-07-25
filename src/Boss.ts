import * as Job from "Job";
import { Operation } from "./Operation";
import { Work } from "./Work";
import JobRecycle from "JobRecycle"
import u from "./Utility";
import { log } from './ScrupsLogger';

export default class Boss implements Work {

  readonly job: Job.Model;
  private _workers: Creep[];

  static fromMemory(memory: BossMemory, jobMap: Job.Map): Boss | undefined {
    const job = jobMap[memory.job] ?? Job.factory.build(memory.job);
    if (!job) return undefined;

    const workers = _.filter(
      u.map_valid_creeps(memory.workers),
      (worker: Creep) => {

        if (worker._job != undefined) {
          log.error(`${worker}: already assigned to ${worker._job}! (not reassigning to ${job.id()})`);
          return false;
        }

        if (job.completion(worker) >= 1.0) {
          log.debug(`${job.id()}: complete!`);
          worker.setLastJob(job);
          worker.setJob(undefined);
          return false;
        }

        //log.debug(`${job.id()}: not complete ${worker.id}`);
        worker.setJob(job.id());
        return true;
      });

    const boss = new Boss(job, workers);
    return boss;
  }

  toMemory(): BossMemory {
    const memory = <BossMemory>{
      job: this.job.id(),
      workers: _.map(this._workers, (worker: Creep): string => { return worker.id }),
    };

    //log.debug(`${this}: to boss memory <${memory.job}, ${memory.workers}, ${memory.subcontractors}>`);
    return memory;
  }

  constructor(job: Job.Model, workers?: Creep[]) {
    this.job = job;
    this._workers = workers || [];

    _.each(this._workers, (worker: Creep) => { worker.setJob(job.id()); });
  }

  id(): string {
    return `boss-${this.job.id()}`;
  }

  toString(): string {
    return this.id();
  }

  hasWorkers(): boolean {
    return this._workers.length > 0;
  }

  workers(): Creep[] {
    return this._workers;
  }

  priority(): number {
    return this.job.priority(this._workers);
  }

  jobComplete(): boolean {
    return this.job.completion() >= 1.0;
  }

  numWorkers(): number {
    return this._workers.length;
  }

  needsWorkers(): boolean {
    return !this.job.isSatisfied(this._workers);
  }

  work(): Operation[] {
    return _.flatten(_.map(this._workers, (worker) => this.job.work(worker)));
  }

  assignWorker(worker: Creep) {
    if (_.find(this._workers, (w: Creep) => { return worker.id == w.id; })) {
      log.debug(`ERROR: ASSIGNED CREEP(${worker}) ALREADY ON ${this}`)
      return;
    }
    log.debug(`${this}: assigning worker ${worker}`);
    worker.setJob(this.job.id());
    this._workers.push(worker);
  }
}
