import { Operation } from 'Operation';
import * as Job from 'Job';
import * as u from 'Utility';
import log from 'ScrupsLogger';
import JobPickup from 'JobPickup';

function drop_at_site(job: JobDrop, worker: Creep): Operation {
  return () => {
    const site = job.dropSite;
    Job.visualize(job, worker);
    if (!worker.pos.isEqualTo(site.pos)) {
      Job.moveTo(job, worker, 0);
      return;
    }

    const resource = RESOURCE_ENERGY;
    const res: number = worker.drop(resource);
    switch (res) {
      case OK:
        // Finished job.
        log.info(`${job}: ${worker} dropped ${resource} to ${site}`);
        break;
      default:
        log.warning(`${job}: ${worker} failed to drop ${worker.store[resource]} ${resource} to ${site} (${u.errstr(res)})`);
        break;
    }
  };
}

export default class JobDrop implements Job.Model {

  static readonly TYPE = 'drop';

  readonly dropSite: StructureContainer;
  readonly dropPriority: number;

  constructor(site: StructureContainer, priority = 1) {
    this.dropSite = site;
    this.dropPriority = priority;
  }

  id(): string {
    return `job-${JobDrop.TYPE}-${this.dropSite.id}`;
  }

  type(): string {
    return JobDrop.TYPE;
  }

  toString(): string {
    return this.id();
  }

  say(): string {
    return '👎';
  }

  styleColour(): string {
    return 'purple';
  }

  priority(_workers?: Creep[]): number {
    return this.dropPriority;
  }

  efficiency(worker: Creep): number {
    if (worker.available() === 0) {
      return 0.0;
    }

    const lastJob: Job.Model = worker.getLastJob();
    if (lastJob && lastJob.site() === this.dropSite && lastJob.type() === JobPickup.TYPE) {
      return 0.0;
    }

    return 0.001;
  }

  site(): RoomObject {
    return this.dropSite;
  }

  isSatisfied(_workers: Creep[]): boolean {
    return true;
  }

  completion(worker?: Creep): number {
    return !worker ? 0.0 : (1.0 - worker.available() / worker.capacity());
  }

  baseWorkerBody(): BodyPartConstant[] {
    return [CARRY, MOVE];
  }

  work(worker: Creep): Operation[] {
    log.debug(`${this}: work operations for ${worker}`);
    return [drop_at_site(this, worker)];
  }
}
