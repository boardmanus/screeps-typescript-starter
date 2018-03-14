import { Operation } from "./Operation";
import { Job, JobFactory, JobPrerequisite } from "./Job";
import { log } from "./lib/logger/log";
import u from "./Utility"


function build_site(job : JobBuild, worker : Creep, site : ConstructionSite) {
  return () => {
    worker.room.visual.circle(site.pos, { fill: 'transparent', radius: 0.55, lineStyle: 'dashed', stroke: 'orange' });
    worker.say('⚒️');
    let res : number = worker.build(site);
    switch (res) {
      case OK:
        log.info(`${job}: ${worker} built stuff at ${site}`);
        break;
      case ERR_NOT_IN_RANGE:
        res = worker.jobMoveTo(site, 3, <LineStyle>{opacity: .4, stroke: 'orange'});
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

export class JobBuild implements Job {

  static readonly TYPE = 'build';

  //private _state : BuildState;
  readonly _site : ConstructionSite;
  readonly _priority : number;

  constructor(site : ConstructionSite, priority? : number) {

    this._site = site;
    this._priority = (priority !== undefined)? priority : 10;
  }

  id() : string {
    return `job-${JobBuild.TYPE}-${this._site.id}-${this._priority}`;
  }

  toString() : string {
    return this.id();
  }

  site() : RoomObject {
    return this._site;
  }
  priority(workers : Creep[]) : number {
    return this._priority/(workers.length + 1);
  }

  isSatisfied(workers : Creep[]) : boolean {
    const energy = _.sum(workers, (w : Creep) : number => { return w.available(); });
    const energyRequired = (this._site.progressTotal - this._site.progress)/(BUILD_POWER);
    return energy >= energyRequired;
  }

  efficiency(worker : Creep) : number {
    return u.work_efficiency(worker, this._site, worker.available(), BUILD_POWER);
  }

  completion(worker? : Creep) : number {
    const completion = this._site.progress/this._site.progressTotal;
    if (!worker || completion == 1.0) {
      return completion;
    }

    return 1.0 - worker.available()/worker.carryCapacity;
  }

  baseWorkerBody() : BodyPartConstant[] {
    return [MOVE, WORK, CARRY];
  }

  satisfiesPrerequisite(prerequisite : JobPrerequisite) : boolean {
    if (prerequisite == JobPrerequisite.DELIVER_ENERGY) {
      return this.completion() < 1.0;
    }

    return false;
  }

  prerequisite(worker : Creep) : JobPrerequisite {
    if (worker.available() == 0) {
      return JobPrerequisite.COLLECT_ENERGY;
    }

    return JobPrerequisite.NONE;
  }

  work(worker : Creep) : Operation[] {
    return [ build_site(this, worker, this._site) ];
  }
}


JobFactory.addBuilder(JobBuild.TYPE, (id: string): Job|undefined => {
  const frags = id.split('-');
  const site = <ConstructionSite>Game.getObjectById(frags[2]);
  if (!site) return undefined;
  const priority = Number(frags[3]);
  return new JobBuild(site, priority);
});
