import { Architect } from "./Architect";
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


function worker_rating(worker : Creep, boss : Boss) : number {
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

  const closeness = boss.job.site().pos.getRangeTo(worker);
  return closeness;
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
  const orderedWorkers = _.sortBy(workers, (w : Creep) => { return worker_rating(w, boss); });
  log.debug(`bestworkers for ${boss}: ${orderedWorkers}`);
  return orderedWorkers;
}

function find_best_boss(worker : Creep, bosses : Boss[]) : Boss|undefined {
  log.debug(`finding best job for ${worker.id} from ${bosses.length} bosses`);
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

  const bestBosses = _.sortBy(satisfiedBosses, (b : Boss) => { return worker_rating(worker, b); });
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
  private _cloner : Cloner;
  private _bosses : Boss[];
  private _cloneWork : Work[];
  private _buildingWork : Work[];

  constructor(city : City) {
    this._city = city;
    this._architect = new Architect(city);
    this._cloner = new Cloner(city);
    this._bosses = map_valid_bosses(city.room.memory.bosses);
    this._cloneWork = [];
    this._buildingWork = [];
  }

  id() : string {
    return `mayor-${this._city.name}`;
  }

  toString() : string {
    return this.id();
  }

  work() : Work[] {
    const allWork = this._cloneWork.concat(this._bosses).concat(this._buildingWork);
    log.debug(`${this}: ${allWork.length} units of work created`);
    return _.sortBy(allWork, (work : Work) : number => {
      return work.priority();
    });
  }

  survey() : void {

    log.debug(`${this}: surveying...`);
    this._architect.survey();
    this._cloner.survey();

    const allJobs : Job[] =
      this.harvestJobs()
      .concat(this.upgradeJobs())
      .concat(this.pickupJobs())
      .concat(this.unloadJobs())
      .concat(this._architect.schedule())
      .concat(this._cloner.schedule());

    log.debug(`${this}: ${allJobs.length} jobs found while surveying.`)

    // Create a boss for every job that doesn't have one.
    const newBosses = _.reduce(
      allJobs,
      (bosses : Boss[], job : Job) : Boss[] => {
        if (!_.find(this._bosses, (boss : Boss) : boolean => { return boss.job.id() == job.id(); })) {
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

    const bosses = this.prioritizeBosses(this._bosses.concat(newBosses));

    const vacancies = _.map(
      _.filter(bosses, (boss : Boss) => { return boss.needsWorkers(); }),
      (boss : Boss) : Job => { return boss.job; });

    log.debug(`${this}: ${vacancies.length} vacant jobs`);

    const unemployed = this._city.room.find<Creep>(FIND_MY_CREEPS, { filter: (worker : Creep) => { return !worker.isEmployed(); }});
    log.debug(`${this}: ${unemployed.length} unemployed workers`)
    const lazyWorkers = this.assignWorkers(bosses, unemployed);

    this._bosses = _.filter(bosses, (boss : Boss) => { return boss.hasWorkers() && !boss.jobComplete(); });
    log.debug(`${this}: ${this._bosses.length} bosses after survey`)

    this._cloneWork = this._cloner.clone(lazyWorkers.length? [] : vacancies);
    this._buildingWork = this._architect.design();
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
      this._city.room.find<Resource>(FIND_DROPPED_RESOURCES),
      (r : Resource) : Job => {
        return new JobPickup(r);
      });

    const takeJobs : Job[] = _.map(
      this._city.room.find<StructureContainer>(FIND_STRUCTURES, { filter: (s : StructureContainer) => {
        return s.structureType == STRUCTURE_CONTAINER && s.availableEnergy() > 0;
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
    const storage : (Storage|Container)[] = this._city.room.find(FIND_STRUCTURES, { filter: (s : Structure) => {
      return s.freeSpace() > 0 && (s.structureType == STRUCTURE_CONTAINER || s.structureType == STRUCTURE_STORAGE);
    }});
    const jobs =  _.map(storage, (s : Storage|Container) : JobUnload => {
      return new JobUnload(s);
    })
    log.info(`${this} scheduling ${jobs.length} unload jobs...`);
    return jobs;
  }

  report() : string[] {
    let r = new Array<string>();
    r.push(`** Mayoral report by ${this}`);
    r.concat(this._architect.report());
    r.concat(this._cloner.report());
    return r;
  }

  save() : void {
    this._architect.save();
    this._cloner.save();

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
    for (worker of orderedWorkers) {
      subcontractingBoss = find_best_boss(worker, allBosses);
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
      log.debug(`${this}: assigning worker ${bestWorker.name}`);
      const bestBoss = find_best_boss(bestWorker, allBosses);
      if (!bestBoss || bestBoss === boss || boss.job.priority() > 3) {
        boss.assignWorker(bestWorker);
      }
      else {
        bestBoss.assignWorker(bestWorker);
      }
    }
    else {
      log.debug(`${this}: looking for a subcontractor from ${allBosses.length} bosses, and ${indirectWorkers.length} workers`);
      this.assignSubcontractor(boss, allBosses, indirectWorkers);
    }

    return _.reject(availableWorkers, (w : Creep) => { return w.isEmployed(); });
  }

  assignWorkers(bosses : Boss[], availableWorkers : Creep[]) : Creep[] {
    let lazyWorkers = availableWorkers;

    for (const boss of bosses) {
      if (lazyWorkers.length == 0) return [];
      lazyWorkers = this.assignWorker(boss, bosses, lazyWorkers);
    }

    return lazyWorkers;
  }
}
