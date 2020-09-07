import { Operation } from 'Operation';
import * as Job from 'Job';
import * as u from 'Utility';
import log from 'ScrupsLogger';

function build_site(job: JobBuild, worker: Creep) {
  return () => {
    const site = job._site;
    Job.visualize(job, worker);
    const dumbPos = (worker.pos.x === 0 || worker.pos.y === 0 || worker.pos.x === 49 || worker.pos.y === 49);
    if (dumbPos) {
      Job.moveTo(job, worker, 0);
      return;
    }

    let res: number = worker.build(site);
    switch (res) {
      case OK:
        log.info(`${job}: ${worker} built stuff at ${site}`);
        break;
      case ERR_NOT_IN_RANGE:
        {
          const range = (site.pos.roomName === worker.pos.roomName) ? 3 : 0;
          res = Job.moveTo(job, worker, range);
        }
        break;
      default:
        log.warning(`${job}: ${worker} failed while building at ${site} (${u.errstr(res)})`);
        break;
    }
  };
}

export default class JobBuild implements Job.Model {

  static readonly TYPE = 'build';

  // private _state : BuildState;
  readonly _site: ConstructionSite;
  readonly _priority: number;

  constructor(site: ConstructionSite, priority = 5) {
    this._site = site;
    this._priority = priority;
  }

  id(): string {
    return `job-${JobBuild.TYPE}-${this._site?.id}`;
  }

  type(): string {
    return JobBuild.TYPE;
  }

  toString(): string {
    return this.id();
  }

  site(): RoomObject {
    return this._site;
  }

  say(): string {
    return '⚒️';
  }

  styleColour(): string {
    return 'yellow';
  }

  priority(workers?: Creep[]): number {
    if (!workers) return this._priority;
    const priority = this._priority / (workers.length + 1);
    return priority;
  }

  isSatisfied(workers: Creep[]): boolean {
    const energy = _.sum(workers, (w) => w.available(RESOURCE_ENERGY));
    const energyRequired = (this._site.progressTotal - this._site.progress) / (BUILD_POWER);
    return energy >= energyRequired;
  }

  efficiency(worker: Creep): number {
    // Calculate the efficiency for working, and then
    // multiply by the ratio available.
    // This should allow fuller workers to be chosen more.
    const available = worker.available(RESOURCE_ENERGY);
    if (available === 0) {
      return 0.0;
    }

    const capacity = worker.capacity();
    const ratio = available / capacity;
    return ratio * u.work_efficiency(worker, this._site, available, BUILD_POWER);
  }

  completion(worker?: Creep): number {
    const completion = this._site.progress / this._site.progressTotal;
    if (!worker || completion === 1.0) {
      return completion;
    }

    return 1.0 - worker.available(RESOURCE_ENERGY) / worker.capacity();
  }

  baseWorkerBody(): BodyPartConstant[] {
    return [MOVE, WORK, CARRY];
  }

  work(worker: Creep): Operation[] {
    return [build_site(this, worker)];
  }
}
