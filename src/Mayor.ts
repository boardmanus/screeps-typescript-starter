import { Architect } from "./Architect";
import { Caretaker } from "./Caretaker";
import { Cloner } from "./Cloner";
import { Job, JobPrerequisite } from "./Job";
import { Work } from "./Work";
import { JobHarvest } from "./JobHarvest";
import { JobUpgrade } from "./JobUpgrade";
import { JobPickup } from "./JobPickup";
import { JobUnload } from "./JobUnload";
import { City } from "./City";
import { Boss } from "./Boss";
import { log } from "./lib/logger/log"
import u from "./Utility";


function worker_rating(worker : Creep, boss : Boss, minPriority : number) : number {
  //const suitability = boss.job.suitability(worker);
  const jobSite = boss.job.site();
  const lastJobSite = worker.getlastJobSite();
  if (jobSite === lastJobSite) {
    return 10000;
  }
  else if (boss.job instanceof JobUnload &&
          boss.job.site() instanceof StructureContainer &&
          lastJobSite && lastJobSite instanceof StructureContainer) {
    // Don't pickup/unload between containers.
    return 10000;
  }

  //const closeness = boss.job.site().pos.getRangeTo(worker);
  //return closeness;
  const p = Math.max(minPriority, boss.priority());
  const e = boss.job.efficiency(worker);

  return -e*p;
}

function find_best_worker(boss : Boss, workers : Creep[]) : Creep|undefined {
  if (workers.length == 0) {
    return undefined;
  }
  return find_best_workers(boss, workers)[0];
}

function find_best_workers(boss : Boss, workers : Creep[]) : Creep[] {
  log.debug(`finding best worker for ${boss} from ${workers.length} workers`);
  if (workers.length == 0) {
    return workers;
  }
  if (workers.length == 1) {
    return workers;
  }
  const orderedWorkers = _.sortBy(workers, (w : Creep) => { return worker_rating(w, boss, 0); });
  log.debug(`bestworkers for ${boss}: ${orderedWorkers}`);
  return orderedWorkers;
}

function find_best_boss(worker : Creep, bosses : Boss[], minPriority : number) : Boss|undefined {
  log.debug(`finding best job for ${worker} from ${bosses.length} bosses`);
  const satisfiedBosses = _.filter(bosses, (b : Boss) => {
    return (b.job.prerequisite(worker) == JobPrerequisite.NONE
      && b.needsWorkers()
      && b.job.site() !== worker.getlastJobSite());
  });

  if (satisfiedBosses.length == 0) {
    return undefined;
  }
  if (satisfiedBosses.length == 1) {
    return satisfiedBosses[1];
  }

  const bestBosses = _.sortBy(satisfiedBosses, (b : Boss) => { return worker_rating(worker, b, minPriority); });
  return bestBosses[0];
}

function map_valid_bosses(memory : BossMemory[]) : Boss[] {
  return u.map_valid(
    memory,
    (boss : BossMemory) : Boss|undefined => { return Boss.fromMemory(boss); });
}

export class Mayor {

  private _city : City;
  private _architect : Architect;
  private _caretaker : Caretaker;
  private _cloner : Cloner;
  private _bosses : Boss[];
  private _cloneWork : Work[];
  private _buildingWork : Work[];
  private _repairWork : Work[];

  constructor(city : City) {
    this._city = city;
    this._architect = new Architect(city);
    this._caretaker = new Caretaker(city);
    this._cloner = new Cloner(city);
    this._bosses = map_valid_bosses(city.room.memory.bosses);
    this._cloneWork = [];
    this._buildingWork = [];
    this._repairWork = [];
  }

  id() : string {
    return `mayor-${this._city.name}`;
  }

  toString() : string {
    return this.id();
  }

  work() : Work[] {
    const allWork = this._cloneWork.concat(this._bosses).concat(this._buildingWork).concat(this._repairWork);
    log.debug(`${this}: ${allWork.length} units of work created`);
    return _.sortBy(allWork, (work : Work) : number => {
      return work.priority();
    });
  }

  survey() : void {

    log.debug(`${this}: surveying...`);
    this._architect.survey();
    this._caretaker.survey();
    this._cloner.survey();

    const allJobs : Job[] =
      this.harvestJobs()
      .concat(this.upgradeJobs())
      .concat(this.pickupJobs())
      .concat(this.unloadJobs())
      .concat(this._architect.schedule())
      .concat(this._cloner.schedule())
      .concat(this._caretaker.schedule());

    log.debug(`${this}: ${allJobs.length} jobs found while surveying.`)

    // Create a boss for every job that doesn't have one.
    const newBosses = _.reduce(
      allJobs,
      (bosses : Boss[], job : Job) : Boss[] => {
        if (_.every(this._bosses, (boss : Boss) : boolean => { return boss.job.id() != job.id(); })) {
          bosses.push(new Boss(job));
        }
        return bosses;
      },
      []);
    log.debug(`${this}: ${this._bosses.length}  old bosses, and ${newBosses.length} new`);

    if (Game.time % 1) {
      log.debug(`${this}: surveying in ${Game.time % 10}`);
      return;
    }

    // Update subcontracts
    _.each(this._bosses, (boss : Boss) => { boss.reassignSubcontractors(); });

    const unemployed : Creep[] = this._city.room.find(FIND_MY_CREEPS, { filter: (worker : Creep) => { return !worker.isEmployed(); }});

    const bosses = this.prioritizeBosses(this._bosses.concat(newBosses));

    const vacancies : Job[] = _.map(
      _.filter(bosses, (boss : Boss) => { return boss.needsWorkers(); }),
      (boss : Boss) : Job => { return boss.job; });

    log.debug(`${this}: ${vacancies.length} vacant jobs`);
    log.debug(`Boss priorities:`);
    _.each(bosses, (boss : Boss) => { log.debug(`${boss}: workers=${boss.numWorkers()}, site=${boss.job.site()}, priority=${boss.priority()}`)});


    log.debug(`${this}: ${unemployed.length} unemployed workers`)
    const lazyWorkers = this.assignWorkers(bosses, unemployed);

    this._bosses = _.filter(bosses, (boss : Boss) => { return boss.hasWorkers() && !boss.jobComplete(); });
    log.debug(`${this}: ${this._bosses.length} bosses after survey`)

    this._cloneWork = this._cloner.clone(lazyWorkers.length? [] : vacancies);
    this._buildingWork = this._architect.design();
    this._repairWork = this._caretaker.repair();
  }

  harvestJobs() : Job[] {
    const jobs : Job[] = _.map<Source, Job>(
      this._city.room.find(FIND_SOURCES),
      (source : Source) : Job => {
        return  new JobHarvest(source);
      });

    log.debug(`${this} scheduling ${jobs.length} harvest jobs...`);
    return jobs;
  }

  pickupJobs() : Job[] {
    const scavengeJobs : Job[] = _.map(
      this._city.room.find(FIND_DROPPED_RESOURCES),
      (r : Resource) : Job => {
        return new JobPickup(r, 5);
      });

    const takeJobs : Job[] = _.map(
      this._city.room.find<StructureContainer>(FIND_STRUCTURES, { filter: (s : AnyStructure) => {
        return (s.structureType == STRUCTURE_CONTAINER || s.structureType == STRUCTURE_STORAGE) && s.availableEnergy() > 0;
      }}),
      (s : StructureContainer) : Job => {
        return new JobPickup(s, 1);
      });

    const jobs = scavengeJobs.concat(takeJobs);
    log.info(`${this} scheduling ${jobs.length} pickup jobs...`);
    return jobs;
  }

  upgradeJobs() : Job[] {
    const controller = this._city.room.controller;
    if (!controller) {
      return [];
    }

    return [ new JobUpgrade(controller) ];
  }

  unloadJobs() : Job[] {
    const storage = this._city.room.find<StructureStorage|StructureContainer|StructureTower>(FIND_STRUCTURES, { filter: (s : AnyStructure) => {
      return s.freeSpace() > 0 && (s.structureType == STRUCTURE_CONTAINER || s.structureType == STRUCTURE_STORAGE || s.structureType == STRUCTURE_TOWER);
    }});
    const foes = this._city.room.find(FIND_HOSTILE_CREEPS);
    const jobs =  _.map(storage, (s : StructureStorage|StructureContainer|StructureTower) : JobUnload => {
      let p = 1;
      if (s.structureType == STRUCTURE_TOWER) {
        if (foes.length) {
          p = 10;
        }
        else {
          p = (s.freeSpace() < 100)? 1 : 5;
        }
      }
      return new JobUnload(s, p);
    });
    log.info(`${this} scheduling ${jobs.length} unload jobs...`);
    return jobs;
  }

  report() : string[] {
    let r = new Array<string>();
    r.push(`** Mayoral report by ${this}`);
    r.concat(this._architect.report());
    r.concat(this._cloner.report());
    r.concat(this._caretaker.report());
    return r;
  }

  save() : void {
    this._architect.save();
    this._cloner.save();
    this._caretaker.save();

    this._city.room.memory.bosses = _.map(
      this._bosses,
      (boss : Boss) : BossMemory => {
        return boss.toMemory();
      });

      log.debug(`${this}: saved.`)
  }

  prioritizeBosses(bosses : Boss[]) : Boss[] {
    return _.sortBy(bosses, (boss : Boss) : number => { return -boss.priority(); });
  }

  assignSubcontractor(boss : Boss, allBosses : Boss[], workers : Creep[]) {
    const orderedWorkers = find_best_workers(boss, workers);
    let worker : Creep|undefined;
    let subcontractingBoss : Boss|undefined;
    const minPriority = 10;
    for (worker of orderedWorkers) {
      subcontractingBoss = find_best_boss(worker, allBosses, minPriority);
      if (!subcontractingBoss) {
        continue;
      }
    }

    if (!worker || !subcontractingBoss) {
      log.warning(`${this}: failed to find subcontractor!`);
      return;
    }

    log.debug(`${this}: assigning subcontract ${worker.name}:${subcontractingBoss} to ${boss}`);
    subcontractingBoss.assignWorker(worker);
    boss.assignSubcontract(subcontractingBoss.job, worker);
  }

  assignWorker(boss : Boss, allBosses : Boss[], availableWorkers : Creep[]) : Creep[] {
    log.debug(`${this}: assigning workers ${boss} needs workers? ${boss.needsWorkers()}`)
    if (!boss.needsWorkers()) {
      return availableWorkers;
    }

    const [ directWorkers, indirectWorkers ] = _.partition(availableWorkers, (w : Creep) => { return boss.job.prerequisite(w) == JobPrerequisite.NONE; });

    const bestWorker = find_best_worker(boss, directWorkers);
    if (bestWorker) {
      boss.assignWorker(bestWorker);
    }
    else {
      log.debug(`${this}: looking for a subcontractor from ${allBosses.length} bosses, and ${indirectWorkers.length} workers`);
      this.assignSubcontractor(boss, allBosses, indirectWorkers);
    }

    return _.reject(availableWorkers, (w : Creep) => { return w.isEmployed(); });
  }

  assignWorkers(bosses : Boss[], availableWorkers : Creep[]) : Creep[] {

    const importantJobs = _.filter(bosses, (b : Boss) => { return b.priority() >= 3; });
    let lazyWorkers = availableWorkers;
    for (const boss of bosses) {
      if (lazyWorkers.length == 0) return [];
      lazyWorkers = this.assignWorker(boss, bosses, lazyWorkers);
    }

    for (const worker of lazyWorkers) {
      const bestBoss = find_best_boss(worker, bosses, 0);
      if (bestBoss) {
        bestBoss.assignWorker(worker);
      }
      else {
        log.error(`${this}: couldn't find a job for ${worker}???`);
      }
    }

    return _.reject(availableWorkers, (w : Creep) => { return w.isEmployed(); });
  }
}
