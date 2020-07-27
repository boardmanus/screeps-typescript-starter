import { Operation } from "./Operation";
import * as Job from "Job";
import u from "./Utility"
import { log } from './ScrupsLogger'
import JobPickup from "JobPickup";

function drop_at_site(job: JobDrop, worker: Creep): Operation {
  return () => {
    const site = job._site;
    Job.visualize(job, worker);
    if (!worker.pos.isEqualTo(site.pos)) {
      const res = Job.moveTo(job, worker, 0);
      return;
    }

    const resource = RESOURCE_ENERGY;
    let res: number = worker.drop(resource);
    switch (res) {
      case OK:
        // Finished job.
        log.info(`${job}: ${worker} dropped ${resource} to ${site}`);
        break;
      default:
        log.warning(`${job}: ${worker} failed to drop ${worker.store[resource]} ${resource} to ${site} (${u.errstr(res)})`);
        break;
    }
  }
}

export default class JobDrop implements Job.Model {

  static readonly TYPE = 'drop';

  readonly _site: StructureContainer;
  readonly _priority: number;

  constructor(site: StructureContainer, priority: number = 1) {
    this._site = site;
    this._priority = priority;
  }

  id(): string {
    return `job-${JobDrop.TYPE}-${this._site.id}`;
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

  priority(workers?: Creep[]): number {
    return this._priority;
  }

  efficiency(worker: Creep): number {
    if (worker.holding() == 0) {
      return 0.0;
    }

    const lastJob: Job.Model = <Job.Model>worker.getLastJob();
    if (lastJob && lastJob.site() === this._site && lastJob.type() === JobPickup.TYPE) {
      return 0.0;
    }

    return 0.001;
  }

  site(): RoomObject {
    return this._site;
  }

  isSatisfied(workers: Creep[]): boolean {
    return true;
  }

  completion(worker?: Creep): number {
    return !worker ? 0.0 : (1.0 - worker.available() / worker.capacity());
  }

  satisfiesPrerequisite(p: Job.Prerequisite): boolean {
    return p == Job.Prerequisite.DELIVER_ENERGY || p == Job.Prerequisite.NONE;
  }

  baseWorkerBody(): BodyPartConstant[] {
    return [CARRY, MOVE];
  }

  work(worker: Creep): Operation[] {
    log.debug(`${this}: work operations for ${worker}`);
    return [drop_at_site(this, worker)];
  }
}


Job.factory.addBuilder(JobDrop.TYPE, (id: string): Job.Model | undefined => {
  const frags = id.split('-');
  const site = <StructureContainer>Game.getObjectById(frags[2]);
  if (!site) return undefined;
  return new JobDrop(site);
});
