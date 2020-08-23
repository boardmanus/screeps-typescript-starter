import { Operation } from "./Operation";
import * as Job from "Job";
import JobUnload from "JobUnload"
import u from "./Utility"
import { log } from './ScrupsLogger'


function withdraw_from_site(job: JobPickup, worker: Creep, site: PickupStoreSite): Operation {
  return () => {
    const lastJob: Job.Model = <Job.Model>worker.getLastJob();
    if (lastJob && lastJob.site() === job.site() && lastJob.type() === JobUnload.TYPE) {
      log.error(`${job}: picking up after dropping off at same site!`)
    }

    Job.visualize(job, worker);
    const resource = u.max_stored_resource(site.store, job._resource);
    const available = site.available(resource);
    const res: number = worker.withdraw(site, resource);
    switch (res) {
      default:
        log.error(`${job}: unexpected error while ${worker} tried withdrawing ${job._resource} from ${site} (${u.errstr(res)})`);
        break;
      case ERR_NOT_IN_RANGE:
        Job.moveTo(job, worker, 1);
        break;
      case OK:
        // Finished job.
        const withdrawn = available - site.available(resource);
        log.info(`${job}: ${worker} withdrew ${withdrawn} resources from ${site}`);
        break;
    }
  }
}

function pickup_at_site(job: JobPickup, worker: Creep, site: Resource): Operation {
  return () => {
    Job.visualize(job, worker);
    let res: number = worker.pickup(site);
    switch (res) {
      case OK:
        // Finished job.
        log.info(`${job}: ${worker} picked up resources from ${site}`);
        break;
      case ERR_NOT_IN_RANGE: {
        res = Job.moveTo(job, worker, 1);
        if (res == OK) {
          if (worker.pickup(site) == OK) {
            log.info(`${job}: ... and ${worker} picked up resources from ${site}`);
          }
        }
        break;
      }
      default:
        log.error(`${job}: unexpected error while ${worker} tried picking up resources-${site} (${u.errstr(res)})`);
        break;
    }
  }
}

function transfer_from_site(job: JobPickup, worker: Creep, site: Creep): Operation {
  return () => {
    Job.visualize(job, worker);
    const resource = u.max_stored_resource(site.store, job._resource);
    let res: number = site.transfer(worker, resource);
    switch (res) {
      case OK:
        // Finished job.
        log.info(`${job}: ${site} transferred ${resource} to ${worker}`);
        break;
      case ERR_NOT_IN_RANGE: {
        Job.moveTo(job, worker, 1);
        break;
      }
      default:
        log.error(`${job}: unexpected error while ${worker} tried picking up resources-${site} (${u.errstr(res)})`);
        break;
    }
  }
}

export default class JobPickup implements Job.Model {

  static readonly TYPE = 'pickup';

  readonly _site: PickupSite;
  readonly _resource: ResourceType;
  readonly _priority: number;

  constructor(site: PickupSite, resource: ResourceType = RESOURCE_ENERGY, priority?: number) {
    this._site = site;
    this._resource = resource;
    this._priority = priority ?? 4;
  }

  id(): string {
    return `job-${JobPickup.TYPE}-${this._resource}-${this._site.id}`;
  }

  type(): string {
    return JobPickup.TYPE;
  }

  toString(): string {
    return this.id();
  }

  say(): string {
    return '🚑';
  }

  styleColour(): string {
    return 'green';
  }

  priority(workers?: Creep[]): number {
    if (!workers) return this._priority;
    return this._priority;
  }

  efficiency(worker: Creep): number {

    const freespace = worker.freeSpace(this._resource);
    if (freespace == 0) {
      return 0.0;
    }

    if (u.find_nearby_attackers(this._site).length > 0) {
      return 0;
    }

    // The energy/s with respect to travel time, and amount to pickup
    const amount = this._site.available(this._resource);
    const e = u.taxi_efficiency(worker, this._site, Math.min(freespace, amount));

    // If the workers last job was dropping off at this site, then
    // reduce the efficiency of a pickup from the same place.
    const lastJob: Job.Model = <Job.Model>worker.getLastJob();
    if (lastJob && (lastJob.site() === this._site) && (lastJob.type() == JobUnload.TYPE)) {
      //log.error(`${this}: ${worker} pickup from dropoff @ ${this._site} (e=0.01*${e})`)
      //return 0.01 * e;
      return 0.0;
    }

    return e;
  }

  site(): RoomObject {
    return this._site;
  }

  isSatisfied(workers: Creep[]): boolean {
    const space = _.sum(workers, (w) => w.freeSpace(this._resource));
    return this._site.available(this._resource) < space;
  }

  completion(worker?: Creep): number {

    const available = this._site.available(this._resource);
    if (available == 0) {
      return 1.0;
    }

    if (worker) {
      if (worker.freeSpace(this._resource) == 0) {
        return 1.0;
      }
      return worker.available() / worker.capacity();
    }

    return 0.0;
  }

  baseWorkerBody(): BodyPartConstant[] {
    return [CARRY, MOVE];
  }

  work(worker: Creep): Operation[] {
    if (this._site instanceof Resource) {
      return [pickup_at_site(this, worker, this._site)];
    }
    else if (this._site instanceof Creep) {
      return [transfer_from_site(this, worker, this._site)];
    }
    else {
      return [withdraw_from_site(this, worker, this._site)];
    }
  }
}


Job.factory.addBuilder(JobPickup.TYPE, (id: string): Job.Model | undefined => {
  const frags = id.split('-');
  const site = <PickupSite>Game.getObjectById(frags[3]);
  if (!site) return undefined;
  const resource = <ResourceType>frags[2]
  return new JobPickup(site, resource);
});
