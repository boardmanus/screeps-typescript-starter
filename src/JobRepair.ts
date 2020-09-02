import { Operation } from 'Operation';
import * as Job from 'Job';
import * as u from 'Utility';
import log from 'ScrupsLogger';

function site_priority(site: Structure, priority: number) {
  switch (site.structureType) {
    case STRUCTURE_CONTAINER: return (1.0 - site.hits / site.hitsMax) * 9;
    default: break;
  }
  return priority;
}

function repair_site(job: JobRepair, worker: Creep) {
  return () => {
    const site = job._site;
    Job.visualize(job, worker);

    const dumbPos = (worker.pos.x === 0 || worker.pos.y === 0 || worker.pos.x === 49 || worker.pos.y === 49);
    if (dumbPos) {
      Job.moveTo(job, worker, 0);
      return;
    }

    const res: number = worker.repair(site);
    switch (res) {
      case OK:
        log.info(`${job}: ${worker} repaired stuff at ${site}`);
        break;
      case ERR_NOT_IN_RANGE: {
        const range = (site.pos.roomName === worker.pos.roomName) ? 3 : 0;
        Job.moveTo(job, worker, range);
        break;
      }
      default:
        log.error(`${job}: ${worker} failed while repairing at ${site} (${u.errstr(res)})`);
        break;
    }
  };
}

export default class JobRepair implements Job.Model {

  static readonly TYPE = 'repair';

  readonly _site: Structure;
  readonly _priority: number;

  constructor(site: Structure, priority?: number) {

    this._site = site;
    this._priority = (priority !== undefined) ? priority : 10;
  }

  id(): string {
    return `job-${JobRepair.TYPE}-${this._site.id}`;
  }

  type(): string {
    return JobRepair.TYPE;
  }

  toString(): string {
    return this.id();
  }

  say(): string {
    return '🛠️';
  }

  styleColour(): string {
    return 'yellow';
  }

  site(): RoomObject {
    return this._site;
  }

  priority(workers?: Creep[]): number {
    const sitePriority = site_priority(this._site, this._priority);
    if (!workers) {
      return sitePriority;
    }
    return sitePriority / (workers.length + 1);
  }

  efficiency(worker: Creep): number {

    const maxHits = u.desired_hits(this._site);
    const available = worker.available(RESOURCE_ENERGY);
    if (available === 0 || this._site.hits >= 0.95 * maxHits) {
      return 0.0;
    }

    const workTime = u.creep_work_time(worker, available, REPAIR_POWER);
    if (workTime === u.FOREVER) {
      return 0.0;
    }

    const travelTime = u.creep_movement_time(worker, this._site);
    if (travelTime === u.FOREVER) {
      return 0.0;
    }

    // If it's going to longer to travel, as it is to work, then don't do it.
    // if (workTime * 5.0 < travelTime) {
    //  return 0.0;
    // }

    // Make sure a decent amount of energy is available.
    const capacity = worker.capacity();
    const ratio = available / capacity;

    // Favor workers with more energy...
    return (ratio * available) / (workTime + travelTime);
  }

  isSatisfied(workers: Creep[]): boolean {
    const maxHits = u.desired_hits(this._site);
    const energy = _.sum(workers, (w: Creep): number => w.available(RESOURCE_ENERGY));
    const damage = maxHits - this._site.hits;
    return (energy * REPAIR_POWER > damage);
  }

  completion(worker?: Creep): number {
    const maxHits = u.desired_hits(this._site);
    if (this._site.hits >= maxHits) {
      return 1.0;
    }

    const c = this._site.hits / maxHits;
    if (!worker) {
      return c;
    }

    const available = worker.available(RESOURCE_ENERGY);
    if (available === 0) {
      return 1.0;
    }

    return Math.max(c, 1.0 - available / worker.capacity());
  }

  baseWorkerBody(): BodyPartConstant[] {
    return [WORK, MOVE, CARRY, MOVE];
  }

  work(worker: Creep): Operation[] {
    return [repair_site(this, worker)];
  }
}
