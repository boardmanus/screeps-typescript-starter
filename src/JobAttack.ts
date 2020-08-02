import { Operation } from "./Operation";
import * as Job from "Job";
import u from "./Utility"
import { log } from './ScrupsLogger'

const TTL_NEARLY_DEAD: number = 200;
const TTL_RECYCLE_TIME: number = 30;

function attack_at_site(job: JobAttack, worker: Creep): Operation {
  return () => {
    const site = job._site;
    Job.visualize(job, worker);

    const dumbPos = (worker.pos.x == 0 || worker.pos.y == 0 || worker.pos.x == 49 || worker.pos.y == 49)
    if (dumbPos) {
      Job.moveTo(job, worker, 0);
    }

    let res: number = worker.attack(site);
    switch (res) {
      case OK:
        log.info(`${job}: ${worker} attacked stuff at ${site}`);
        break;
      case ERR_NOT_IN_RANGE: {
        Job.moveTo(job, worker, 1);
        break;
      }
      default:
        log.error(`${job}: ${worker} failed while attacking at ${site} (${u.errstr(res)})`);
        break;
    }
  }
}

export default class JobAttack implements Job.Model {

  static readonly TYPE = 'attacker';

  readonly _site: Creep;
  readonly _priority: number;

  constructor(site: Creep, priority: number = 7) {
    this._site = site;
    this._priority = priority;
  }

  id(): string {
    return `job-${JobAttack.TYPE}-${this._site.name}`;
  }

  type(): string {
    return JobAttack.TYPE;
  }

  toString(): string {
    return this.id();
  }

  say(): string {
    return '🗡️';
  }

  styleColour(): string {
    return 'red';
  }

  priority(workers?: Creep[]): number {
    return this._priority;
  }

  efficiency(worker: Creep): number {
    // Scouts should hold nothing
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
    // A scout is never finished.
    if (this._site) {
      return 0.0;
    }
    return 1.0;
  }

  baseWorkerBody(): BodyPartConstant[] {
    return [MOVE, MOVE, ATTACK, ATTACK];
  }

  work(worker: Creep): Operation[] {
    return [attack_at_site(this, worker)];
  }
}


Job.factory.addBuilder(JobAttack.TYPE, (id: string): Job.Model | undefined => {
  const frags = id.split('-');
  const creep = <Creep>Game.getObjectById(frags[2]);
  if (!creep) return undefined;
  return new JobAttack(creep);
});
