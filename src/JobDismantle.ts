import { Operation } from 'Operation';
import * as Job from 'Job';
import * as u from 'Utility';
import log from 'ScrupsLogger';

function dismantle_site(job: JobDismantle, worker: Creep) {
  return () => {
    const site = job.dismantleSite;
    Job.visualize(job, worker);
    const dumbPos = (worker.pos.x === 0 || worker.pos.y === 0 || worker.pos.x === 49 || worker.pos.y === 49);
    if (dumbPos) {
      Job.moveTo(job, worker, 0);
      return;
    }

    let res: number = worker.dismantle(site);
    switch (res) {
      case OK:
        log.info(`${job}: ${worker} dismantled stuff at ${site}`);
        break;
      case ERR_NOT_IN_RANGE:
        {
          const range = (site.pos.roomName === worker.pos.roomName) ? 1 : 0;
          res = Job.moveTo(job, worker, range);
        }
        break;
      default:
        log.warning(`${job}: ${worker} failed while dismantling at ${site} (${u.errstr(res)})`);
        break;
    }
  };
}

export default class JobDismantle implements Job.Model {

  static readonly TYPE = 'dismantle';

  // private _state : DismantleState;
  readonly dismantleSite: Structure;
  readonly dismantlePriority: number;

  constructor(site: Structure, priority = 5) {

    this.dismantleSite = site;
    this.dismantlePriority = priority;
  }

  id(): string {
    return `job-${JobDismantle.TYPE}-${this.dismantleSite.id}`;
  }

  type(): string {
    return JobDismantle.TYPE;
  }

  toString(): string {
    return this.id();
  }

  site(): RoomObject {
    return this.dismantleSite;
  }

  say(): string {
    return '🪓';
  }

  styleColour(): string {
    return 'red';
  }

  priority(workers?: Creep[]): number {
    if (!workers) return this.dismantlePriority;
    const priority = this.dismantlePriority / (workers.length + 1);
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
    if (free === 0) {
      return 0.0;
    }

    const numWorkParts = worker.getActiveBodyparts(WORK);
    if (numWorkParts < 4) {
      return 0;
    }

    return u.work_efficiency(worker, this.dismantleSite, free, 0.25);
  }

  completion(worker?: Creep): number {
    const completion = this.dismantleSite.hits / this.dismantleSite.hitsMax;
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
