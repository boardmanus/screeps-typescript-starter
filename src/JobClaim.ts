import { Operation } from "./Operation";
import * as Job from "Job";
import u from "./Utility"
import { log } from './ScrupsLogger'

const TTL_NEARLY_DEAD: number = 200;
const TTL_RECYCLE_TIME: number = 30;

function claim_at_site(job: JobClaim, worker: Creep): Operation {
  return () => {
    Job.visualize(job, worker);

    if (job._site instanceof Flag) {
      Job.moveTo(job, worker, 1);
      return;
    }

    let res: number = worker.claimController(job._site);
    switch (res) {
      case OK:
        // Finished job.
        log.info(`${job}: ${worker} claimed ${job._site}`);
        break;
      case ERR_NOT_IN_RANGE: {
        res = Job.moveTo(job, worker, 1);
        break;
      }
      default:
        log.error(`${job}: unexpected error while ${worker} tried claiming ${job._site} (${u.errstr(res)})`);
        break;
    }
  }
}

export default class JobClaim implements Job.Model {

  static readonly TYPE = 'claim';

  readonly _site: StructureController | Flag;
  readonly _priority: number;

  constructor(site: StructureController | Flag, priority: number = 1) {
    this._site = site;
    this._priority = priority;
  }

  id(): string {
    return `job-${JobClaim.TYPE}-${this._site.pos.roomName}`;
  }

  type(): string {
    return JobClaim.TYPE;
  }

  toString(): string {
    return this.id();
  }

  say(): string {
    return '🤴';
  }

  styleColour(): string {
    return 'blue';
  }

  priority(workers?: Creep[]): number {
    return this._priority;
  }

  efficiency(worker: Creep): number {
    // Claimers should hold nothing
    if (worker.available() != 0
      || worker.getActiveBodyparts(CLAIM) == 0) {
      return 0.0;
    }

    if (u.find_nearby_attackers(this._site, 20).length > 0) {
      return 0.0;
    }

    return 1.0;
  }

  site(): RoomObject {
    return this._site;
  }

  isSatisfied(workers: Creep[]): boolean {
    // The job is satisfied if it has a worker
    return workers.length > 0;
  }

  completion(worker?: Creep): number {
    // A claim is never finished.
    if (this._site instanceof Flag) {
      return 0.0;
    }

    return this._site.my ? 1.0 : 0.0;
  }

  baseWorkerBody(): BodyPartConstant[] {
    return [MOVE, CLAIM];
  }

  work(worker: Creep): Operation[] {
    if (!worker.spawning) {
      return [claim_at_site(this, worker)];
    }
    return [];
  }
}


Job.factory.addBuilder(JobClaim.TYPE, (id: string): Job.Model | undefined => {
  const frags = id.split('-');
  const room = Game.rooms[frags[2]];
  if (!room || !room.controller) return undefined;
  return new JobClaim(room.controller);
});
