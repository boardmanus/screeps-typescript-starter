import { Operation } from "./Operation";
import * as Job from "Job";
import u from "./Utility"
import { log } from './ScrupsLogger'


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

    const dumbPos = (worker.pos.x == 0 || worker.pos.y == 0 || worker.pos.x == 49 || worker.pos.y == 49)
    if (dumbPos) {
      Job.moveTo(job, worker, 0);
      return;
    }

    let res: number = worker.repair(site);
    switch (res) {
      case OK:
        log.info(`${job}: ${worker} repaired stuff at ${site}`);
        break;
      case ERR_NOT_IN_RANGE: {
        const range = (site.pos.roomName == worker.pos.roomName) ? 3 : 0;
        Job.moveTo(job, worker, range);
        break;
      }
      default:
        log.error(`${job}: ${worker} failed while repairing at ${site} (${u.errstr(res)})`);
        break;
    }
  }
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

    if (worker.available() == 0 || this._site.hits >= this._site.hitsMax) {
      return 0.0;
    }

    const workTime = u.creep_work_time(worker, worker.available(), REPAIR_POWER);
    if (workTime == u.FOREVER) {
      return 0.0;
    }

    const travelTime = u.creep_movement_time(worker, this._site);
    if (travelTime == u.FOREVER) {
      return 0.0;
    }

    // If it's going to longer to travel, as it is to work, then don't do it.
    //if (workTime * 5.0 < travelTime) {
    //  return 0.0;
    //}

    return worker.available() / (workTime + travelTime);
  }

  isSatisfied(workers: Creep[]): boolean {
    const energy = _.sum(workers, (w: Creep): number => { return w.available(); });
    const workParts = _.sum(workers, (w: Creep): number => {
      return _.sum(w.body, (b: BodyPartDefinition): number => { return b.type == WORK ? 1 : 0; });
    });
    const damage = this._site.hitsMax - this._site.hitsMax;
    return (energy * 100 * workParts > damage);
  }

  completion(worker?: Creep): number {
    if (this._site.hits >= this._site.hitsMax) {
      return 1.0;
    }

    const c = this._site.hits / this._site.hitsMax;
    if (!worker) {
      return c;
    }

    return Math.max(c, 1.0 - worker.available() / worker.capacity());
  }

  baseWorkerBody(): BodyPartConstant[] {
    return [WORK, MOVE, CARRY, MOVE];
  }

  satisfiesPrerequisite(prerequisite: Job.Prerequisite): boolean {
    if (prerequisite == Job.Prerequisite.DELIVER_ENERGY || prerequisite == Job.Prerequisite.NONE) {
      return this.completion() < 1.0;
    }

    return false;
  }

  work(worker: Creep): Operation[] {
    return [repair_site(this, worker)];
  }
}


Job.factory.addBuilder(JobRepair.TYPE, (id: string): Job.Model | undefined => {
  const frags = id.split('-');
  const site = <Structure>Game.getObjectById(frags[2]);
  if (!site) return undefined;
  const priority = Number(frags[3]);
  return new JobRepair(site);
});
