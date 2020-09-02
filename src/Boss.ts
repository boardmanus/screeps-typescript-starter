import * as Job from 'Job';
import { Operation } from 'Operation';
import Work from 'Work';
import log from 'ScrupsLogger';
import { profile } from 'Profiler/Profiler';

@profile
export default class Boss implements Work {

  readonly job: Job.Model;
  private _workers: Creep[];

  constructor(job: Job.Model) {
    this.job = job;
    this._workers = [];
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
    return _.flatten(_.map(_.filter(this._workers, (w) => !w.spawning), (w) => this.job.work(w)));
  }

  assignWorker(worker: Creep) {
    if (_.find(this._workers, (w: Creep) => worker.id === w.id)) {
      log.debug(`ERROR: ASSIGNED CREEP(${worker}) ALREADY ON ${this}`);
      return;
    }
    worker.setJob(this.job);
    this._workers.push(worker);
  }
}
