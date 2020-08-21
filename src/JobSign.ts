import { Operation } from "./Operation";
import * as Job from "Job";
import u from "./Utility"
import { log } from './ScrupsLogger'


function sign_at_site(job: JobSign, worker: Creep): Operation {
  return () => {
    Job.visualize(job, worker);

    const controller: StructureController = job._site;
    let res: number = worker.signController(controller, job.message);
    switch (res) {
      case OK:
        // Finished job.
        log.info(`${job}: ${worker} signed ${controller}`);
        break;
      case ERR_NOT_IN_RANGE: {
        res = Job.moveTo(job, worker, 1);
        break;
      }
      default:
        log.error(`${job}: unexpected error while ${worker} tried sign ${job._site} (${u.errstr(res)})`);
        break;
    }
  }
}

export default class JobSign implements Job.Model {

  static readonly TYPE = 'sign';

  readonly _site: StructureController;
  readonly _priority: number;
  readonly username: string;
  readonly message: string;

  constructor(site: StructureController, message: string = "mine!", priority: number = 1) {
    this._site = site;
    this._priority = priority;
    this.username = _.find(Game.spawns)?.owner.username ?? 'nodbody';
    this.message = message;
  }

  id(): string {
    return `job-${JobSign.TYPE}-${this._site.pos.roomName}`;
  }

  type(): string {
    return JobSign.TYPE;
  }

  toString(): string {
    return this.id();
  }

  say(): string {
    return '🖋️';
  }

  styleColour(): string {
    return 'blue';
  }

  priority(workers?: Creep[]): number {
    return this._priority;
  }

  efficiency(worker: Creep): number {
    const time = u.creep_movement_time(worker, this._site);
    return 1000 / time;
  }

  site(): RoomObject {
    return this._site;
  }

  isSatisfied(workers: Creep[]): boolean {
    // The job is satisfied if it has a worker
    return workers.length > 0;
  }

  completion(worker?: Creep): number {
    return (this._site.sign?.username === this.username) ? 1.0 : 0.0;
  }

  baseWorkerBody(): BodyPartConstant[] {
    return [MOVE];
  }

  work(worker: Creep): Operation[] {
    if (!worker.spawning) {
      return [sign_at_site(this, worker)];
    }
    return [];
  }
}


Job.factory.addBuilder(JobSign.TYPE, (id: string): Job.Model | undefined => {
  const frags = id.split('-');
  const room = Game.rooms[frags[2]];
  if (!room || !room.controller) return undefined;
  return new JobSign(room.controller);
});
