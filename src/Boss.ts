import { Job, JobFactory } from "./Job";
import { Operation } from "./Operation";
import { Work } from "./Work";
import { log } from "./lib/logger/log";
import u from "./Utility";


export class Boss implements Work {

  readonly job: Job;
  private _workers: Creep[];

  static fromMemory(memory: BossMemory): Boss | undefined {
    const job = JobFactory.build(memory.job);
    if (!job) return undefined;

    const workers = _.filter(
      u.map_valid_creeps(memory.workers),
      (worker: Creep) => {
        if (job.completion(worker) < 1.0) {
          worker.setEmployed(true);
          return true;
        }

        worker.setLastJobSite(job.site());
        worker.setEmployed(false);
        return false;
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

  constructor(job: Job, workers?: Creep[]) {
    this.job = job;
    this._workers = workers || [];

    _.each(this._workers, (worker: Creep) => { worker.setEmployed(true); });
  }

  id(): string {
    return `boss-${this.job}`;
  }

  toString(): string {
    return this.id();
  }

  hasWorkers(): boolean {
    return this._workers.length > 0;
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
    return _.flatten(_.map(
      this._workers,
      (worker: Creep): Operation[] => { return this.job.work(worker); }));
  }

  assignWorker(worker: Creep) {
    worker.memory.job = this.job.id();
    if (_.find(this._workers, (w: Creep) => { return worker.id == w.id; })) {
      log.error(`ASSIGNED CREEP(${worker}) ALREADY ON ${this}`)
      return;
    }
    log.debug(`${this}: assigning worker ${worker}`);
    worker.setEmployed(true);
    this._workers.push(worker);
  }
}
