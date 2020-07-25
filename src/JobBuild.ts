import { Operation } from "./Operation";
import * as Job from "Job";
import u from "./Utility"
import { log } from "lib/logger/log";


function build_site(job: JobBuild, worker: Creep, site: ConstructionSite) {
  return () => {
    worker.room.visual.circle(site.pos, { fill: 'transparent', radius: 0.55, lineStyle: 'dashed', stroke: 'orange' });
    worker.say('⚒️');
    const dumbPos = (worker.pos.x == 0 || worker.pos.y == 0 || worker.pos.x == 49 || worker.pos.y == 49)
    if (dumbPos) {
      const res = worker.jobMoveTo(site, 0, <LineStyle>{ opacity: .4, stroke: 'orange' });
      if (res == OK) {
        log.info(`${job}: ${worker} moved to build site ${site} (${worker.pos.getRangeTo(site)} sq)`);
      }
      else {
        log.error(`${job}: ${worker} failed moving to build @ ${site} (${worker.pos.getRangeTo(site)} sq) (${u.errstr(res)})`);
      }
      return;
    }

    let res: number = worker.build(site);
    switch (res) {
      case OK:
        log.info(`${job}: ${worker} built stuff at ${site}`);
        break;
      case ERR_NOT_IN_RANGE:
        const range = (site.pos.roomName == worker.pos.roomName) ? 3 : 0;
        res = worker.jobMoveTo(site, range, <LineStyle>{ opacity: .4, stroke: 'orange' });
        if (res == OK) {
          log.info(`${job}: ${worker} moved to construction site ${site} (${worker.pos.getRangeTo(site)} sq)`);
        }
        else {
          log.error(`${job}: ${worker} failed moving to controller-${site} (${worker.pos.getRangeTo(site)} sq) (${u.errstr(res)})`);
        }
        break;
      default:
        log.warning(`${job}: ${worker} failed while building at ${site} (${u.errstr(res)})`);
        break;
    }
  }
}

export default class JobBuild implements Job.Model {

  static readonly TYPE = 'build';

  //private _state : BuildState;
  readonly _site: ConstructionSite;
  readonly _priority: number;

  constructor(site: ConstructionSite, priority: number = 5) {

    this._site = site;
    this._priority = priority;
  }

  id(): string {
    return `job-${JobBuild.TYPE}-${this._site.id}`;
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

  priority(workers?: Creep[]): number {
    if (!workers) return this._priority;
    const priority = this._priority / (workers.length + 1);
    return priority;
  }

  isSatisfied(workers: Creep[]): boolean {
    const energy = _.sum(workers, (w: Creep): number => { return w.available(); });
    const energyRequired = (this._site.progressTotal - this._site.progress) / (BUILD_POWER);
    return energy >= energyRequired;
  }

  efficiency(worker: Creep): number {
    // Calculate the efficiency for working with full energy, and then
    // multiply by the ratio available.
    // This should allow fuller workers to be chosen more.
    const ratio = worker.available() / worker.capacity();
    return ratio * u.work_efficiency(worker, this._site, worker.capacity(), BUILD_POWER);
  }

  completion(worker?: Creep): number {
    const completion = this._site.progress / this._site.progressTotal;
    if (!worker || completion == 1.0) {
      return completion;
    }

    return 1.0 - worker.available() / worker.carryCapacity;
  }

  baseWorkerBody(): BodyPartConstant[] {
    return [MOVE, WORK, CARRY];
  }

  satisfiesPrerequisite(prerequisite: Job.Prerequisite): boolean {
    if (prerequisite == Job.Prerequisite.DELIVER_ENERGY) {
      return this.completion() < 1.0;
    }

    return false;
  }

  prerequisite(worker: Creep): Job.Prerequisite {
    if (worker.available() == 0) {
      return Job.Prerequisite.COLLECT_ENERGY;
    }

    return Job.Prerequisite.NONE;
  }

  work(worker: Creep): Operation[] {
    return [build_site(this, worker, this._site)];
  }
}


Job.factory.addBuilder(JobBuild.TYPE, (id: string): Job.Model | undefined => {
  const frags = id.split('-');
  const site = <ConstructionSite>Game.getObjectById(frags[2]);
  if (!site) return undefined;
  const priority = Number(frags[3]);
  return new JobBuild(site);
});
