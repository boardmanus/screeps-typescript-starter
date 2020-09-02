import * as Job from 'Job';
import JobUnload from 'JobUnload';
import { Operation } from 'Operation';
import * as u from 'Utility';
import log from 'ScrupsLogger';

function withdraw_from_site(job: JobPickup, worker: Creep, site: PickupStoreSite): Operation {
  return () => {
    Job.visualize(job, worker);

    if (!worker.pos.inRangeTo(site, 1)) {
      Job.moveTo(job, worker, 1);
    }
    const resource = u.max_stored_resource(site.store, job.resource);
    const available = site.available(resource);
    const res: number = worker.withdraw(site, resource);
    switch (res) {
      default:
        log.error(`${job}: unexpected error while ${worker} tried withdrawing ${job.resource} from ${site} (${u.errstr(res)})`);
        break;
      case ERR_NOT_IN_RANGE:
        break;
      case OK:
        {
          // Finished job.
          const withdrawn = available - site.available(resource);
          log.info(`${job}: ${worker} withdrew ${withdrawn} resources from ${site}`);
          break;
        }
    }
  };
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
        if (res === OK) {
          if (worker.pickup(site) === OK) {
            log.info(`${job}: ... and ${worker} picked up resources from ${site}`);
          }
        }
        break;
      }
      default:
        log.error(`${job}: unexpected error while ${worker} tried picking up resources-${site} (${u.errstr(res)})`);
        break;
    }
  };
}

function transfer_from_site(job: JobPickup, worker: Creep, site: Creep): Operation {
  return () => {
    Job.visualize(job, worker);
    const resource = u.max_stored_resource(site.store, job.resource);
    const res: number = site.transfer(worker, resource);
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
  };
}

export default class JobPickup implements Job.Model {

  static readonly TYPE = 'pickup';

  readonly pickupSite: PickupSite;
  readonly resource: ResourceType;
  readonly pickupPriority: number;

  constructor(site: PickupSite, resource: ResourceType = RESOURCE_ENERGY, priority?: number) {
    this.pickupSite = site;
    this.resource = resource;
    this.pickupPriority = priority ?? 4;
  }

  id(): string {
    return `job-${JobPickup.TYPE}-${this.resource}-${this.pickupSite.id}`;
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
    if (!workers) return this.pickupPriority;
    return this.pickupPriority;
  }

  efficiency(worker: Creep): number {

    const freespace = worker.freeSpace(this.resource);
    if (freespace === 0) {
      return 0.0;
    }

    if (u.find_nearby_hostiles(this.pickupSite).length > 0) {
      return 0;
    }

    // The energy/s with respect to travel time, and amount to pickup
    const amount = this.pickupSite.available(this.resource);
    const e = u.taxi_efficiency(worker, this.pickupSite, Math.min(freespace, amount));

    // If the workers last job was dropping off at this site, then
    // reduce the efficiency of a pickup from the same place.
    const lastJob: Job.Model = worker.getLastJob();
    if (lastJob && (lastJob.site() === this.pickupSite) && (lastJob.type() === JobUnload.TYPE)) {
      // log.error(`${this}: ${worker} pickup from dropoff @ ${this._site} (e=0.01*${e})`)
      // return 0.01 * e;
      return 0.0;
    }

    return e;
  }

  site(): RoomObject {
    return this.pickupSite;
  }

  isSatisfied(workers: Creep[]): boolean {
    const space = _.sum(workers, (w) => w.freeSpace(this.resource));
    return this.pickupSite.available(this.resource) < space;
  }

  completion(worker?: Creep): number {

    const available = this.pickupSite.available(this.resource);
    if (available === 0) {
      return 1.0;
    }

    if (worker) {
      if (worker.freeSpace(this.resource) === 0) {
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
    if (this.pickupSite instanceof Resource) {
      return [pickup_at_site(this, worker, this.pickupSite)];
    }

    if (this.pickupSite instanceof Creep) {
      return [transfer_from_site(this, worker, this.pickupSite)];
    }

    return [withdraw_from_site(this, worker, this.pickupSite)];
  }
}
