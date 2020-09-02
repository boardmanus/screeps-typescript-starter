import * as Job from 'Job';
import { Operation } from './Operation';

function scout_at_site(job: JobScout, worker: Creep): Operation {
  return () => {
    Job.visualize(job, worker);
    Job.moveTo(job, worker, 0);
  };
}

export default class JobScout implements Job.Model {

  static readonly TYPE = 'scout';

  readonly _site: Flag;
  readonly _priority: number;

  constructor(site: Flag, priority = 1) {
    this._site = site;
    this._priority = priority;
  }

  id(): string {
    return `job-${JobScout.TYPE}-${this._site.name}`;
  }

  type(): string {
    return JobScout.TYPE;
  }

  toString(): string {
    return this.id();
  }

  say(): string {
    return '🤖';
  }

  styleColour(): string {
    return 'blue';
  }

  priority(_workers?: Creep[]): number {
    return this._priority;
  }

  efficiency(worker: Creep): number {
    // Scouts should hold nothing
    if (worker.available() !== 0) {
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

  completion(_worker?: Creep): number {
    // A scout is never finished.
    return 0.0;
  }

  baseWorkerBody(): BodyPartConstant[] {
    return [MOVE, MOVE];
  }

  work(worker: Creep): Operation[] {
    if (!worker.spawning && !worker.pos.inRangeTo(this._site.pos, 0)) {
      return [scout_at_site(this, worker)];
    }
    return [];
  }
}
