import { Operation } from "./Operation";
import * as Job from "Job";
import u from "./Utility"
import { log } from './ScrupsLogger'

const TTL_NEARLY_DEAD: number = 200;
const TTL_RECYCLE_TIME: number = 30;

function reserve_at_site(job: JobReserve, worker: Creep): Operation {
  return () => {
    Job.visualize(job, worker);

    if (job._site instanceof Flag) {
      Job.moveTo(job, worker, 1);
      return;
    }

    const controller: StructureController = job._site;
    let res: number = worker.reserveController(controller);
    switch (res) {
      case OK:
        // Finished job.
        log.info(`${job}: ${worker} reserved ${controller}`);
        if (controller.sign?.username !== worker.owner.username) {
          worker.signController(controller, 'All your base are belong to us!');
        }
        break;
      case ERR_NOT_IN_RANGE: {
        res = Job.moveTo(job, worker, 1);
        break;
      }
      default:
        log.error(`${job}: unexpected error while ${worker} tried reserving ${job._site} (${u.errstr(res)})`);
        break;
    }
  }
}

export default class JobReserve implements Job.Model {

  static readonly TYPE = 'reserve';

  readonly _site: StructureController | Flag;
  readonly _priority: number;

  constructor(site: StructureController | Flag, priority: number = 1) {
    this._site = site;
    this._priority = priority;
  }

  id(): string {
    return `job-${JobReserve.TYPE}-${this._site.pos.roomName}`;
  }

  type(): string {
    return JobReserve.TYPE;
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
    // Reserveers should hold nothing
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
    if (this._site instanceof Flag) {
      return 0.0;
    }

    if (!this._site.reservation) {
      return 0.0;
    }

    //if (this._site.reservation.username !== Game.rooms[0].controller?.owner?.username) {
    //  return 0.0;
    //}

    return this._site.reservation.ticksToEnd / CONTROLLER_RESERVE_MAX;
  }

  baseWorkerBody(): BodyPartConstant[] {
    return [MOVE, CLAIM];
  }

  work(worker: Creep): Operation[] {
    if (!worker.spawning) {
      return [reserve_at_site(this, worker)];
    }
    return [];
  }
}


Job.factory.addBuilder(JobReserve.TYPE, (id: string): Job.Model | undefined => {
  const frags = id.split('-');
  const room = Game.rooms[frags[2]];
  if (!room || !room.controller) return undefined;
  return new JobReserve(room.controller);
});
