import { Operation } from 'Operation';
import * as Job from 'Job';
import * as u from 'Utility';
import log from 'ScrupsLogger';

const TTL_NEARLY_DEAD = 200;
const TTL_RECYCLE_TIME = 30;

function recycle_at_site(job: JobRecycle, worker: Creep): Operation {
  return () => {
    const site = job._site;

    const recycler = site.recycler();
    const recycleSite = recycler ?? site;
    Job.visualize(job, worker, recycleSite);

    if ((recycler && !worker.pos.isEqualTo(recycler.pos))
      || (!recycler && !worker.pos.inRangeTo(site.pos, 1))) {
      Job.moveTo(job, worker, recycler ? 0 : 1, recycler);
      return;
    }

    const res: number = site.recycleCreep(worker);
    switch (res) {
      case OK:
        // Finished job.
        log.info(`${job}: ${worker} recycled ${worker} @ ${site}`);
        break;
      default:
        log.warning(`${job}: ${worker} failed to recycle ${worker} @ ${site} (${u.errstr(res)})`);
        break;
    }
  };
}

export default class JobRecycle implements Job.Model {

  static readonly TYPE = 'recycle';

  readonly _site: StructureSpawn;
  readonly _priority: number;

  constructor(site: StructureSpawn, priority = 1) {
    this._site = site;
    this._priority = priority;
  }

  id(): string {
    return `job-${JobRecycle.TYPE}-${this._site.id}`;
  }

  type(): string {
    return JobRecycle.TYPE;
  }

  toString(): string {
    return this.id();
  }

  say(): string {
    return '☠️';
  }

  styleColour(): string {
    return 'red';
  }

  priority(_workers?: Creep[]): number {
    return this._priority;
  }

  efficiency(worker: Creep): number {
    if (worker.memory.superfluous) {
      return 1.0;
    }

    if (!worker.ticksToLive || worker.ticksToLive > TTL_NEARLY_DEAD) {
      return 0.0;
    }

    const recycler = this._site.recycler();
    const site = recycler ?? this._site;
    const timeToRecycler = u.creep_movement_time(worker, site);

    if (worker.ticksToLive - timeToRecycler > TTL_RECYCLE_TIME) {
      log.warning(`${this}: ${worker} nearly dead (ttl=${worker.ticksToLive} <= ${TTL_NEARLY_DEAD})`);
      return 0.0;
    }

    log.warning(`${this}: ${worker} due to be recycled (ttl=${worker.ticksToLive} - ttr=${timeToRecycler} <= ${TTL_RECYCLE_TIME})`);

    return 1000.0;
  }

  site(): RoomObject {
    return this._site;
  }

  isSatisfied(_workers: Creep[]): boolean {
    return false;
  }

  completion(worker?: Creep): number {
    if (worker && worker.ticksToLive && worker.ticksToLive > 100) {
      return 1.0;
    }
    return 0.0;
  }

  baseWorkerBody(): BodyPartConstant[] {
    return [];
  }

  work(worker: Creep): Operation[] {
    log.debug(`${this}: work operations for ${worker}`);
    return [recycle_at_site(this, worker)];
  }
}
