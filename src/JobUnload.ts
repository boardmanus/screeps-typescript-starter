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
      resource = <ResourceConstant>_.max(Object.keys(worker.carry), (r: ResourceConstant) => { return worker.carry[r]; });
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
          log.error(`${job}: ${worker} failed moving to controller-${site} (${worker.pos.getRangeTo(site)} sq) (${u.errstr(res)})`);
        }
        break;
      default:
        log.warning(`${job}: ${worker} failed to transfer ${worker.carry[resource]} ${resource} to ${site} (${u.errstr(res)})`);
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

export class JobUnload implements Job.Model {

  static readonly TYPE = 'unload';

  readonly _site: UnloadSite;
  readonly _priority: number;
  readonly _superJob?: Job.Model;

  constructor(site: UnloadSite, priority?: number, superJob?: Job.Model) {
    this._site = site;
    this._priority = (priority !== undefined) ? priority : 1;
    this._superJob = superJob;
  }

  id(): string {
    return `job-${JobUnload.TYPE}-${this._site.id}-${this._priority}`;
  }

  toString(): string {
    return this.id();
  }

  superJob(): Job.Model | undefined {
    return this._superJob;
  }
  priority(workers: Creep[]): number {
    return this._priority;
  }

  efficiency(worker: Creep): number {

    //if (worker.getLastJobSite() === this._site) {
    //  return 0;
    //}

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
    return u.work_efficiency(worker, this._site, resources_available(worker, this._site), 10000);
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

    if (worker) {
      return resources_available(worker, this._site) > 0 ? 0.0 : 1.0;
    }

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
