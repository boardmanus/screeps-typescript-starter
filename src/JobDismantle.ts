import { Operation } from "./Operation";
import * as Job from "Job";
import u from "./Utility"
import { log } from "lib/logger/log";


function dismantle_site(job: JobDismantle, worker: Creep) {
  return () => {
    const site = job._site;
    Job.visualize(job, worker);
    const dumbPos = (worker.pos.x == 0 || worker.pos.y == 0 || worker.pos.x == 49 || worker.pos.y == 49)
    if (dumbPos) {
      const res = Job.moveTo(job, worker, 0);
      return;
    }

    let res: number = worker.dismantle(site);
    switch (res) {
      case OK:
        log.info(`${job}: ${worker} dismantled stuff at ${site}`);
        break;
      case ERR_NOT_IN_RANGE:
        const range = (site.pos.roomName == worker.pos.roomName) ? 1 : 0;
        res = Job.moveTo(job, worker, range);
        break;
      default:
        log.warning(`${job}: ${worker} failed while dismantling at ${site} (${u.errstr(res)})`);
        break;
    }
  }
}

export default class JobDismantle implements Job.Model {

  static readonly TYPE = 'dismantle';

  //private _state : DismantleState;
  readonly _site: Structure;
  readonly _priority: number;

  constructor(site: Structure, priority: number = 5) {

    this._site = site;
    this._priority = priority;
  }

  id(): string {
    return `job-${JobDismantle.TYPE}-${this._site.id}`;
  }

  type(): string {
    return JobDismantle.TYPE;
  }

  toString(): string {
    return this.id();
  }

  site(): RoomObject {
    return this._site;
  }

  say(): string {
    return '🪓';
  }

  styleColour(): string {
    return 'red';
  }

  priority(workers?: Creep[]): number {
    if (!workers) return this._priority;
    const priority = this._priority / (workers.length + 1);
    return priority;
  }

  isSatisfied(workers: Creep[]): boolean {
    return workers.length > 0;
  }

  efficiency(worker: Creep): number {
    // Calculate the efficiency for working, and then
    // multiply by the ratio available.
    // This should allow fuller workers to be chosen more.
    const free = worker.freeSpace(RESOURCE_ENERGY);
    if (free == 0) {
      return 0.0;
    }

    const numWorkParts = worker.getActiveBodyparts(WORK);
    if (numWorkParts < 4) {
      return 0;
    }

    return u.work_efficiency(worker, this._site, free, 0.25);
  }

  completion(worker?: Creep): number {
    const completion = this._site.hits / this._site.hitsMax;
    if (!worker || completion >= 1.0) {
      return completion;
    }

    return 1.0 - worker.freeSpace(RESOURCE_ENERGY) / worker.capacity();
  }

  baseWorkerBody(): BodyPartConstant[] {
    return [MOVE, WORK, CARRY];
  }

  work(worker: Creep): Operation[] {
    return [dismantle_site(this, worker)];
  }
}


Job.factory.addBuilder(JobDismantle.TYPE, (id: string): Job.Model | undefined => {
  const frags = id.split('-');
  const site = <Structure>Game.getObjectById(frags[2]);
  if (!site) return undefined;
  return new JobDismantle(site);
});
