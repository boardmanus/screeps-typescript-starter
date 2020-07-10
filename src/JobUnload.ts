import { Operation } from "./Operation";
import * as Job from "Job";
import u from "./Utility"
import { log } from './ScrupsLogger'

function unload_at_site(job: JobUnload, worker: Creep, site: UnloadSite): Operation {
  return () => {
    worker.room.visual.circle(site.pos, { fill: 'transparent', radius: 0.55, lineStyle: 'dashed', stroke: 'orange' });
    worker.say('🚑');
    let resource: ResourceConstant = RESOURCE_ENERGY;
    if (site.structureType == STRUCTURE_CONTAINER || site.structureType == STRUCTURE_STORAGE) {
      resource = <ResourceConstant>_.max(Object.keys(worker.store), (r: ResourceConstant) => { return worker.store[r]; });
    }

    log.debug(`${job}: ${worker} trying to transfer ${worker.store[resource]} of ${resource} to ${site}`)
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
          log.warning(`${job}: ${worker} failed moving to controller-${site} (${worker.pos.getRangeTo(site)} sq) (${u.errstr(res)})`);
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
    case STRUCTURE_STORAGE: {
      return worker.carry.getUsedCapacity();
    }
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

    if (worker.getLastJobSite() === this._site) {
      return 0;
    }

    switch (this._site.structureType) {
      case STRUCTURE_LINK:
      case STRUCTURE_CONTAINER:
        {
          const distance = this._site.pos.getRangeTo(worker);
          if (distance > 5) {
            return 0;
          }
          break;
        }
      default:
        break;
    }
    return u.taxi_efficiency(worker, this._site, Math.min(worker.available(), this._site.freeSpace()));
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
    if (this._site instanceof StructureTower) {
      if (this._site.freeSpace() <= TOWER_ENERGY_COST) {
        return 1.0;
      }
    }

    if (worker && (resources_available(worker, this._site) == 0)) {
      return 1.0;
    }

    log.debug(`${this}: not completed (1.0 - ${this._site.freeSpace()} / ${this._site.capacity()})`)
    return 1.0 - this._site.freeSpace() / this._site.capacity();
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
    log.debug(`${this}: work operations for ${worker}`);
    return [unload_at_site(this, worker, this._site)];
  }
}


Job.factory.addBuilder(JobUnload.TYPE, (id: string): Job.Model | undefined => {
  const frags = id.split('-');
  const site = <UnloadSite>Game.getObjectById(frags[2]);
  if (!site) return undefined;
  const priority = Number(frags[3]);
  return new JobUnload(site, priority);
});
