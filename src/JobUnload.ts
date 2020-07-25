import { Operation } from "./Operation";
import * as Job from "Job";
import u from "./Utility"
import { log } from './ScrupsLogger'
import JobPickup from "JobPickup";

function unload_at_site(job: JobUnload, worker: Creep, site: UnloadSite): Operation {
  return () => {
    worker.room.visual.circle(site.pos, { fill: 'transparent', radius: 0.55, lineStyle: 'dashed', stroke: 'orange' });
    worker.say('🚑');
    let resource: ResourceConstant = RESOURCE_ENERGY;
    if (site.structureType == STRUCTURE_TERMINAL || site.structureType == STRUCTURE_STORAGE) {
      resource = <ResourceConstant>_.max(Object.keys(worker.store), (r: ResourceConstant) => { return worker.store[r]; });
    }

    let res: number = worker.transfer(site, resource);
    switch (res) {
      case OK:
        // Finished job.
        log.info(`${job}: ${worker} transferred ${resource} to ${site}`);
        break;
      case ERR_NOT_IN_RANGE:
        res = worker.jobMoveTo(site, 1, <LineStyle>{ opacity: .4, stroke: 'orange' });
        if (res == OK) {
          log.info(`${job}: ${worker} moved towards unload site ${site} (${worker.pos.getRangeTo(site)} sq)`);
        }
        else {
          log.warning(`${job}: ${worker} failed moving to unload site ${site} (${worker.pos.getRangeTo(site)} sq) (${u.errstr(res)})`);
        }
        break;
      default:
        log.warning(`${job}: ${worker} failed to transfer ${worker.store[resource]} ${resource} to ${site} (${u.errstr(res)})`);
        break;
    }
  }
}

function resources_available(worker: Creep, site: UnloadSite): number {
  switch (site.structureType) {
    case STRUCTURE_STORAGE:
    case STRUCTURE_TERMINAL:
      return worker.holding();
    default: {
      return worker.available(RESOURCE_ENERGY);
    }
  }
}

export default class JobUnload implements Job.Model {

  static readonly TYPE = 'unload';

  readonly _site: UnloadSite;
  readonly _priority: number;

  constructor(site: UnloadSite, priority: number = 1) {
    this._site = site;
    this._priority = priority;
  }

  id(): string {
    return `job-${JobUnload.TYPE}-${this._site.id}`;
  }

  type(): string {
    return JobUnload.TYPE;
  }

  toString(): string {
    return this.id();
  }

  priority(workers?: Creep[]): number {
    return this._priority;
  }

  efficiency(worker: Creep): number {

    const lastJob = <Job.Model>worker.getLastJob();
    if (lastJob && lastJob.site() === this._site && lastJob.type() === JobPickup.TYPE) {
      return 0;
    }

    let e = u.taxi_efficiency(worker, this._site, Math.min(worker.available(), this._site.freeSpace()));
    if (this._site instanceof StructureStorage) {
      const optimumRatio = worker.holding() / worker.capacity();
      e *= optimumRatio;
      if (this._site.pos.getRangeTo(worker) < 5) {
        e /= 5;
      }
    }

    return e;
  }

  site(): RoomObject {
    return this._site;
  }

  isSatisfied(workers: Creep[]): boolean {
    return this._site.freeSpace() - _.sum(workers, (w: Creep): number => {
      return resources_available(w, this._site)
    }) <= 0;
  }

  completion(worker?: Creep): number {
    const freespace = this._site.freeSpace();
    if (freespace == 0
      || ((this._site instanceof StructureTower)
        && (freespace <= TOWER_ENERGY_COST))) {
      return 1.0;
    }

    if (worker && (resources_available(worker, this._site) == 0)) {
      return 1.0;
    }

    return this._site.holding() / this._site.capacity();
  }

  satisfiesPrerequisite(p: Job.Prerequisite): boolean {
    return p == Job.Prerequisite.DELIVER_ENERGY && this._site.freeSpace() > 0;
  }

  prerequisite(worker: Creep): Job.Prerequisite {
    if (resources_available(worker, this._site) == 0) {
      return Job.Prerequisite.COLLECT_ENERGY;
    }
    return Job.Prerequisite.NONE;
  }

  baseWorkerBody(): BodyPartConstant[] {
    return [CARRY, MOVE];
  }

  work(worker: Creep): Operation[] {
    return [unload_at_site(this, worker, this._site)];
  }
}


Job.factory.addBuilder(JobUnload.TYPE, (id: string): Job.Model | undefined => {
  const frags = id.split('-');
  const site = <UnloadSite>Game.getObjectById(frags[2]);
  if (!site) return undefined;
  const priority = Number(frags[3]);
  return new JobUnload(site);
});
