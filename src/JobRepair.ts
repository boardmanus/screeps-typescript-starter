import { Operation } from "./Operation";
import { Job, JobFactory, JobPrerequisite } from "./Job";
import { log } from "./lib/logger/log";
import u from "./Utility"


function repair_site(job : JobRepair, worker : Creep, site : Structure) {
  return () => {
    worker.room.visual.circle(site.pos, { fill: 'transparent', radius: 0.55, lineStyle: 'dashed', stroke: 'orange' });
    worker.say('🛠️');
    let res : number = worker.repair(site);
    switch (res) {
      case OK:
        log.info(`${job}: ${worker} repaired stuff at ${site}`);
        break;
      case ERR_NOT_IN_RANGE: {
        res = worker.jobMoveTo(site, 3, <LineStyle>{opacity: .4, stroke: 'orange'});
        if (res == OK) {
          log.info(`${job}: ${worker} moved to repair site ${site} (${worker.pos.getRangeTo(site)} sq)`);
        }
        else {
          log.error(`${job}: ${worker} failed moving to controller-${site} (${worker.pos.getRangeTo(site)} sq) (${u.errstr(res)})`);
        }
        break;
      }
      default:
        log.warning(`${job}: ${worker} failed while repairing at ${site} (${u.errstr(res)})`);
        break;
    }
  }
}

export class JobRepair implements Job {

  static readonly TYPE = 'repair';

  readonly _site : Structure;
  readonly _priority : number;

  constructor(site : Structure, priority? : number) {

    this._site = site;
    this._priority = (priority !== undefined)? priority : 10;
  }

  id() : string {
    return `job-${JobRepair.TYPE}-${this._site.id}-${Math.round(this._priority)}`;
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

  efficiency(worker : Creep) : number {
    return u.work_efficiency(worker, this._site, worker.available(), REPAIR_POWER);
  }

  isSatisfied(workers : Creep[]) : boolean {
    const energy = _.sum(workers, (w : Creep) : number => { return w.available(); });
    const workParts = _.sum(workers, (w : Creep) : number => {
      return _.sum(w.body, (b : BodyPartDefinition) : number => { return b.type == WORK? 1 : 0; });
    });
    const damage = this._site.hitsMax - this._site.hitsMax;
    return (energy*100*workParts > damage);
  }

  completion(worker? : Creep) : number {
    const completion = this._site.hits/this._site.hitsMax;
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
    return [ repair_site(this, worker, this._site) ];
  }
}


JobFactory.addBuilder(JobRepair.TYPE, (id: string): Job|undefined => {
  const frags = id.split('-');
  const site = <Structure>Game.getObjectById(frags[2]);
  if (!site) return undefined;
  const priority = Number(frags[3]);
  log.debug(`JobFactory-build repair ${frags} - priority=${priority}`);
  return new JobRepair(site, priority);
});
