import { Operation } from "./Operation";
import * as Job from "Job";
import JobDrop from "JobDrop"
import u from "./Utility"
import { log } from './ScrupsLogger'


function withdraw_from_site(job: JobPickup, worker: Creep, site: Structure | Tombstone): Operation {
  return () => {
    Job.visualize(job, worker);
    let res: number = worker.withdraw(site, RESOURCE_ENERGY);
    switch (res) {
      default:
        log.error(`${job}: unexpected error while ${worker} tried withdrawing from ${site} (${u.errstr(res)})`);
        break;
      case ERR_NOT_IN_RANGE:
        res = Job.moveTo(job, worker, 1);
        break;
      case OK:
        // Finished job.
        log.info(`${job}: ${worker} withdrew resources from ${site}`);
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

export default class JobPickup implements Job.Model {

  static readonly TYPE = 'pickup';

  readonly _site: PickupSite;
  readonly _priority: number;

  constructor(site: PickupSite, priority?: number) {
    this._site = site;
    this._priority = (priority !== undefined) ? priority : 4;
  }

  id(): string {
    return `job-${JobPickup.TYPE}-${this._site.id}`;
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

    if (worker.freeSpace() == 0) {
      return 0.0;
    }

    if (u.find_nearby_attackers(this._site).length > 0) {
      return 0;
    }

    // The energy/s with respect to travel time, and amount to pickup
    const e = u.taxi_efficiency(worker, this._site, Math.min(worker.freeSpace(), this._site.available()));

    // If the workers last job was dropping off at this site, then
    // reduce the efficiency of a pickup from the same place.
    const lastJob: Job.Model = <Job.Model>worker.getLastJob();
    if (lastJob && (lastJob.site() === this._site) && (lastJob.type() == JobDrop.TYPE)) {
      return 0.01 * e;
    }

    return e;
  }

  site(): RoomObject {
    return this._site;
  }

  isSatisfied(workers: Creep[]): boolean {
    const space = _.sum(workers, (w: Creep): number => { return w.freeSpace(); });
    return this._site.available() < space;
  }

  completion(worker?: Creep): number {

    const available = this._site.available();
    if (available == 0) {
      return 1.0;
    }

    if (worker) {
      if (worker.freeSpace() == 0) {
        return 1.0;
      }
      return worker.holding() / worker.capacity();
    }

    return 0.0;
  }

  baseWorkerBody(): BodyPartConstant[] {
    return [CARRY, MOVE];
  }

  satisfiesPrerequisite(prerequisite: Job.Prerequisite): boolean {
    if (prerequisite == Job.Prerequisite.COLLECT_ENERGY || prerequisite == Job.Prerequisite.NONE) {
      return this._site.available() > 0;
    }

    return false;
  }

  work(worker: Creep): Operation[] {
    if (this._site instanceof Resource) {
      return [pickup_at_site(this, worker, this._site)];
    }
    else {
      return [withdraw_from_site(this, worker, this._site)];
    }
  }
}


Job.factory.addBuilder(JobPickup.TYPE, (id: string): Job.Model | undefined => {
  const frags = id.split('-');
  const site = <PickupSite>Game.getObjectById(frags[2]);
  if (!site) return undefined;
  const priority = Number(frags[3]);
  return new JobPickup(site);
});
