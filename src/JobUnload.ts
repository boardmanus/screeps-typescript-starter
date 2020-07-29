import { Operation } from "./Operation";
import * as Job from "Job";
import u from "./Utility"
import { log } from './ScrupsLogger'
import JobPickup from "JobPickup";

function is_energy_only(site: UnloadSite): boolean {
  switch (site.structureType) {
    case STRUCTURE_STORAGE:
    case STRUCTURE_TERMINAL:
    case STRUCTURE_CONTAINER:
      return false;
    default: {
      return true;
    }
  }
}

function best_resource(worker: Creep, site: UnloadSite, resourceType: ResourceType): ResourceConstant {
  if (is_energy_only(site)) {
    return RESOURCE_ENERGY;
  }

  return u.max_stored_resource(worker.store, resourceType);
}

function unload_at_site(job: JobUnload, worker: Creep): Operation {
  return () => {
    const site = job._site;
    Job.visualize(job, worker);

    const resource = best_resource(worker, site, job._resource);
    let res: number = worker.transfer(site, resource);
    switch (res) {
      case OK:
        // Finished job.
        log.info(`${job}: ${worker} transferred ${resource} to ${site}`);
        break;
      case ERR_NOT_IN_RANGE:
        Job.moveTo(job, worker, 1);
        break;
      default:
        log.warning(`${job}: ${worker} failed to transfer ${worker.store[resource]} ${resource} to ${site} (${u.errstr(res)})`);
        break;
    }
  }
}

export default class JobUnload implements Job.Model {

  static readonly TYPE = 'unload';

  readonly _site: UnloadSite;
  readonly _resource: ResourceType;
  readonly _priority: number;

  constructor(site: UnloadSite, resource: ResourceType = RESOURCE_ENERGY, priority: number = 1) {
    this._site = site;
    this._resource = resource;
    this._priority = priority;
  }

  id(): string {
    return `job-${JobUnload.TYPE}-${this._resource}-${this._site.id}`;
  }

  type(): string {
    return JobUnload.TYPE;
  }

  toString(): string {
    return this.id();
  }

  say(): string {
    return '🚑';
  }

  styleColour(): string {
    return 'orange';
  }

  priority(workers?: Creep[]): number {
    return this._priority;
  }

  efficiency(worker: Creep): number {

    const available = worker.available(this._resource);
    const free = this._site.freeSpace(this._resource);
    if (available == 0 || free == 0) {
      return 0.0;
    }

    const lastJob = <Job.Model>worker.getLastJob();
    if (lastJob && lastJob.site() === this._site && lastJob.type() === JobPickup.TYPE) {
      return 0.0;
    }

    const unloadable = Math.min(available, free);

    let e = u.taxi_efficiency(worker, this._site, unloadable);
    if (this._site instanceof StructureStorage) {
      const optimumRatio = available / worker.capacity();
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
    return this._site.freeSpace(this._resource) - _.sum(workers, (w: Creep): number => {
      return w.available(this._resource);
    }) <= 0;
  }

  completion(worker?: Creep): number {
    const freespace = this._site.freeSpace(this._resource);
    if (freespace == 0
      || ((this._site instanceof StructureTower)
        && (freespace <= TOWER_ENERGY_COST))) {
      return 1.0;
    }

    if (worker && (worker.available(this._resource) == 0)) {
      return 1.0;
    }

    return 1.0 - freespace / this._site.capacity();
  }

  baseWorkerBody(): BodyPartConstant[] {
    return [CARRY, MOVE];
  }

  work(worker: Creep): Operation[] {
    return [unload_at_site(this, worker)];
  }
}


Job.factory.addBuilder(JobUnload.TYPE, (id: string): Job.Model | undefined => {
  const frags = id.split('-');
  const site = <UnloadSite>Game.getObjectById(frags[3]);
  if (!site) return undefined;
  const resource = <ResourceType>frags[2];
  return new JobUnload(site, resource);
});
