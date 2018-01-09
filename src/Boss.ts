import { Job, JobFactory } from "./Job";
import { Operation } from "./Operation";
import { Work } from "./Work";
import { log } from "./lib/logger/log";
import u from "./Utility";

function map_valid_subcontractors(subcontractorsMemory : SubcontractorMemory[]) : Subcontractor[] {
  return u.map_valid(
    subcontractorsMemory,
    (subcontractorMemory : SubcontractorMemory) : Subcontractor|undefined => { return Subcontractor.fromMemory(subcontractorMemory)});
}

class Subcontractor {
  readonly job : Job;
  readonly worker : Creep;

  static fromMemory(memory : SubcontractorMemory) : Subcontractor|undefined {
    const worker : Creep|null = Game.getObjectById(memory.worker);
    if (!worker) {
      return undefined;
    }

    const job = JobFactory.build(memory.job);
    if (!job) {
      return undefined;
    }

    return new Subcontractor(job, worker);
  }

  constructor(job : Job, worker : Creep) {
    this.job = job;
    this.worker = worker;
  }

  toMemory() : SubcontractorMemory {
    return <SubcontractorMemory>{
      job: this.job.id(),
      worker: this.worker.id
    };
  }
}

export class Boss implements Work {

  readonly job : Job;
  private _workers : Creep[];
  private _subcontractors : Subcontractor[];

  static fromMemory(memory : BossMemory) : Boss|undefined {
    const job = JobFactory.build(memory.job);
    if (!job) return undefined;

    const workers = _.reduce(
      u.map_valid_creeps(memory.workers),
      (activeWorkers : Creep[], worker : Creep) => {
        if (job.completion(worker) < 1.0) {
          activeWorkers.push(worker);
        }
        else {
          worker.setEmployed(false);
        }
        return activeWorkers;
      },
    []);

    const subcontractors = map_valid_subcontractors(memory.subcontractors);
    const boss = new Boss(job, workers, subcontractors);
    log.debug(`${boss.id()}: from boss memory ${memory.job}, ${memory.workers}, ${memory.subcontractors}`);
    return boss;
  }

  toMemory() : BossMemory {
    const memory = <BossMemory>{
      job: this.job.id(),
      workers: _.map(this._workers, (worker : Creep) : string => { return worker.id }),
      subcontractors: _.map(this._subcontractors, (sc : Subcontractor) : SubcontractorMemory => { return sc.toMemory() })
    };

    log.debug(`${this.id()}: to boss memory <${memory.job}, ${memory.workers}, ${memory.subcontractors}>`);
    return memory;
  }

  constructor(job : Job, workers? : Creep[], subcontractors? : Subcontractor[]) {
    this.job = job;
    this._workers = workers || [];
    this._subcontractors = subcontractors || [];

    _.each(this._workers, (worker : Creep) => { worker.setEmployed(true); });
  }

  id() : string {
    return `boss-${this.job.id()}`;
  }

  toString() : string {
    return this.id();
  }

  satisfaction(worker : Creep) : number {
    return 0.5;
  }

  hasWorkers() : boolean {
    return this._workers.length > 0 || this._subcontractors.length > 0;
  }

  priority() : number {
    return this.job.priority() * this._workers.length;
  }

  jobComplete() : boolean {
    return this.job.completion() >= 1.0;
  }

  numWorkers() : number {
    return this._workers.length;
  }

  needsWorkers() : boolean {
    return !this.job.isSatisfied(
      this._workers.concat(
        _.map(this._subcontractors, (s : Subcontractor): Creep => { return s.worker; })));
  }

  work() : Operation[] {
    return _.flatten(_.map(
      this._workers,
      (worker : Creep) : Operation[] => { return this.job.work(worker); }));
  }

  assignWorker(worker : Creep) {
    worker.memory.job = this.job.id();
    if (_.find(this._workers, (w : Creep) => { return worker.id == w.id; })) {
      log.error(`ASSIGNED CREEP(${worker.id}) ALREADY ON ${this.id()}`)
      return;
    }
    worker.setEmployed(true);
    this._workers.push(worker);
  }

  assignSubcontract(job : Job, worker : Creep) {
    this._subcontractors.push(new Subcontractor(job, worker));
  }

  reassignSubcontractors() {
    const remainingSubcontractors = _.reduce(
      this._subcontractors,
      (a : Subcontractor[], subcontractor : Subcontractor) => {
        if (subcontractor.job.completion(subcontractor.worker) < 1.0) {
          a.push(subcontractor);
        }
        else {
          this.assignWorker(subcontractor.worker);
        }
        return a;
      },
      []);

      this._subcontractors = remainingSubcontractors;
  }
}
