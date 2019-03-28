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
import { Operation } from "./Operation";
import { log } from "./lib/logger/log";
import u from "./Utility";


function worker_rating(worker : Creep, boss : Boss, minPriority : number) : number {
  //const suitability = boss.job.suitability(worker);
  const jobSite = boss.job.site();
  const lastJobSite = worker.getLastJobSite();
  if (jobSite === lastJobSite) {
    return 10000;
  }
  else if (lastJobSite &&
          boss.job instanceof JobUnload &&
          jobSite instanceof StructureContainer &&
          lastJobSite instanceof StructureContainer) {
    // Don't pickup/unload between containers.
    return 10000;
  }

  //const closeness = boss.job.site().pos.getRangeTo(worker);
  //return closeness;
  const p = Math.max(minPriority, boss.priority());
  const e = boss.job.efficiency(worker);

  return -e*p;
}

function map_valid_bosses(memory : BossMemory[]) : Boss[] {
  return u.map_valid(
    memory,
    (boss : BossMemory) : Boss|undefined => { return Boss.fromMemory(boss); });
}

function map_valid_to_links(linkers : (Source|StructureStorage|StructureSpawn)[], to : boolean) : StructureLink[] {
  return _.filter(u.map_valid(linkers, (s : Source|StructureStorage|StructureSpawn) : StructureLink|undefined|null => {
      return s._link;
    }),
    (l : StructureLink) => {
      return (to && l.freeSpace() > 100) || (!to && l.cooldown == 0 && l.available() > 100);
    });
}

class TransferWork implements Work {

  readonly from : StructureLink;
  readonly to : StructureLink;
  readonly amount : number;

  constructor(from : StructureLink, to : StructureLink, amount : number) {
    this.from = from;
    this.to = to;
    this.amount = amount;
  }

  id() {
    return `work-transfer-${this.from}-${this.to}`;
  }

  toString() : string {
    return this.id();
  }

  priority() : number {
    return 0;
  }

  work() : Operation[] {
    return [ () => {
      const res = this.from.transferEnergy(this.to, this.amount);
      switch (res) {
        case OK:
          log.info(`${this}: transfered ${this.amount} of energy from ${this.from} to ${this.to}`);
          break;
        default:
          log.error(`${this}: failed to transfer energy from ${this.from} to ${this.to} (${u.errstr(res)})`);
          break;
      }
    } ];
  }
}

export class Mayor {

  private _city : City;
  private _architect : Architect;
  private _caretaker : Caretaker;
  private _cloner : Cloner;
  private _bosses : Boss[];

  constructor(city : City) {
    this._city = city;
    this._architect = new Architect(city);
    this._caretaker = new Caretaker(city);
    this._cloner = new Cloner(city);
    this._bosses = map_valid_bosses(city.room.memory.bosses);
  }

  id() : string {
    return `mayor-${this._city.name}`;
  }

  toString() : string {
    return this.id();
  }

  work() : Work[] {

    const noWork : Work[] = [];

    const allWork = noWork.concat(
        this._bosses,
        this._cloner.clone([]),
        this._architect.design(),
        this._caretaker.repair(),
        this.transferEnergy());

    log.debug(`${this}: ${allWork.length} units of work created`);
    return _.sortBy(allWork, (work : Work) : number => {
      return work.priority();
    });
  }

  private transferEnergy() : Work[] {
    const room = this._city.room;
    const fromLinks = map_valid_to_links(room.find(FIND_SOURCES), false);

    const linkers : (StructureStorage|StructureSpawn)[] = room.find(FIND_MY_SPAWNS);
    if (room.storage) {
      linkers.push(room.storage);
    }

    const toLinks = _.sortBy(map_valid_to_links(linkers, true), (l : StructureLink) => { return l.available(); });
    log.debug(`${this}: transfer energy from ${fromLinks.length} links to ${toLinks.length} others`);

    const transferWork : Work[] = [];
    _.each(fromLinks, (fl : StructureLink) => {
      let amountAvailable = fl.available();
      if (amountAvailable < 100) {
        return;
      }

      _.each(toLinks, (tl : StructureLink) => {
        const transferAmount = Math.min(amountAvailable, tl.freeSpace());
        if (transferAmount < 100) {
          return;
        }
        amountAvailable -= transferAmount;
        transferWork.push(new TransferWork(fl, tl, transferAmount));
      })
    });

    return transferWork;
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
    const allBosses = this._bosses.concat(newBosses);
    const [ employers, noVacancies] = _.partition(allBosses, (b : Boss) => { return b.needsWorkers(); });
    const lazyWorkers = this.assignWorkers(employers, unemployed);

    log.debug(`${this}: ${employers.length} employers`);
    log.debug(`${this}: ${unemployed.length} unemployed workers`);
    log.debug(`${this}: ${lazyWorkers.length} lazy workers`);
    log.debug(`${this}: ${this._bosses.length} bosses before survey`)
    this._bosses = _.filter(allBosses, (boss : Boss) => { return boss.hasWorkers() && !boss.jobComplete(); });
    log.debug(`${this}: ${this._bosses.length} bosses after survey`)
  }

  harvestJobs() : Job[] {
    const jobs : Job[] = _.map<Source, Job>(
      this._city.room.find(FIND_SOURCES_ACTIVE),
      (source : Source) : Job => {
        return  new JobHarvest(source);
      });

    log.debug(`${this} scheduling ${jobs.length} harvest jobs...`);
    return jobs;
  }

  pickupJobs() : Job[] {
    const room = this._city.room;

    const scavengeJobs : Job[] = _.map(
      room.find(FIND_DROPPED_RESOURCES),
      (r : Resource) : Job => {
        return new JobPickup(r, 5);
      });

    //const tombstoneJobs : Job[] = _.map(
    //  room.find(FIND_TOMBSTONES)
    //)

    const takeJobs : Job[] = _.map(
      room.find<StructureContainer>(FIND_STRUCTURES, { filter: (s : AnyStructure) => {
        return (s.structureType == STRUCTURE_CONTAINER || s.structureType == STRUCTURE_STORAGE) && s.available() > 0;
      }}),
      (s : StructureContainer) : Job => {
        return new JobPickup(s, 1);
      });

    const linkers : (StructureSpawn|StructureStorage)[] = _.filter(room.find(FIND_MY_SPAWNS));
    if (room.storage) {
      linkers.push(room.storage);
    }

    const links : StructureLink[] = u.map_valid(
      linkers,
      (s : StructureSpawn|StructureStorage) => { return s._link; });

    const linkJobs = u.map_valid(links, (link : StructureLink) => {
      const energy = link.available();
      if (energy > 100) {
        const space = link.freeSpace();
        const p = (
          (space < 100)? 5
          : (space < 300)? 4
          : (space < 600)? 3
          : 2);

        return new JobPickup(link, p);
      }

      return null;
    });

    const jobs = scavengeJobs.concat(takeJobs, linkJobs);
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
    const room = this._city.room;
    const towers = room.find<StructureTower>(FIND_MY_STRUCTURES, { filter: (s : AnyStructure) => {
      return (s.structureType == STRUCTURE_STORAGE || s.structureType == STRUCTURE_TOWER) && s.freeSpace() > 0;
    }});
    const foes = room.find(FIND_HOSTILE_CREEPS);
    const unloadJobs : JobUnload[] =  _.map(towers, (s : StructureTower) : JobUnload => {
      let p = 1;
      if (foes.length) {
        p = 10;
      }
      else {
        p = (s.freeSpace() < 100)? 1 : 5;
      }
      return new JobUnload(s, p);
    });

    if (room.storage && room.storage.freeSpace() > 0) {
      unloadJobs.push(new JobUnload(room.storage, 1));
    }

    const sourceUnloadJobs = u.map_valid(room.find(FIND_SOURCES), (s : Source) : JobUnload[] => {
      const jobs : JobUnload[] = [];
      const storage = room.storage;
      if (s._link) {
        jobs.push(new JobUnload(s._link, 1));
      }

      if (s._container) {
        jobs.push(new JobUnload(s._container, 1));
      }

      return jobs;
    });

    const jobs : JobUnload[] = unloadJobs.concat(_.flatten(sourceUnloadJobs));
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

  assignWorkers(bosses : Boss[], availableWorkers : Creep[]) : Creep[] {

    if (bosses.length == 0 || availableWorkers.length == 0) {
      log.debug(`${this}: no bosses or workers to assign.`)
      return [];
    }

    const [sourceJobs, sinkJobs] = _.partition(bosses, (b : Boss) => { return b.job.satisfiesPrerequisite(JobPrerequisite.COLLECT_ENERGY); });
    const [emptyWorkers, energizedWorkers] = _.partition(availableWorkers, (w : Creep) => { return w.available() == 0; });
    const [fullWorkers, multipurposeWorkers] = _.partition(energizedWorkers, (w : Creep) => { return w.freeSpace() == 0; });

    log.debug(`${this}: assigning ${fullWorkers.length} full workers to ${sinkJobs.length} sink jobs`);
    const [hiringSinks, lazyFull] = assign_workers(sinkJobs, fullWorkers);
    log.debug(`${this}: assigning ${emptyWorkers.length} empty workers to ${sourceJobs.length} source jobs`);
    const [hiringSources, lazyEmpty] = assign_workers(sourceJobs, emptyWorkers);
    log.debug(`${this}: assigning ${multipurposeWorkers.length} workers to ${hiringSources.length + hiringSinks.length} left-over jobs`);
    const [hiring, lazyMulti]  = assign_workers(hiringSinks.concat(hiringSources), multipurposeWorkers);

    return lazyFull.concat(lazyEmpty, lazyMulti);
  }
}

type WorkerBossPairing = { rating: number, boss: Boss, worker: Creep };
function get_worker_pairings(bosses: Boss[], workers: Creep[]) : WorkerBossPairing[] {
  const pairings: WorkerBossPairing[] = [];
  _.each(bosses, (b: Boss) => {
    _.each(workers, (w: Creep) => {
      const rating = worker_rating(w, b, 0);
      if (rating < 0.0) {
        pairings.push({ rating: rating, boss: b, worker: w })
      }
    });
  });

  return _.sortBy(pairings, (wbp: WorkerBossPairing): number => { return wbp.rating; });
}

function assign_best_workers(bosses: Boss[], workers: Creep[]) : [Boss[], Creep[]] {
  if (bosses.length == 0 || workers.length == 0) {
    return [bosses, workers];
  }

  let pairings: WorkerBossPairing[] = get_worker_pairings(bosses, workers);
  if (pairings.length == 0) {
    return [bosses, workers];
  }

  const assignedBosses : Boss[] = [];
  const assignedWorkers : Creep[] = [];
  let bestPairing : WorkerBossPairing;
  do {
    bestPairing = pairings[0];
    bestPairing.boss.assignWorker(bestPairing.worker);
    assignedBosses.push(bestPairing.boss);
    assignedWorkers.push(bestPairing.worker);
    bestPairing.worker.room.visual.line(bestPairing.worker.pos, bestPairing.boss.job.site().pos, { width: 0.2, color: 'red', lineStyle: 'dotted' });
    bestPairing.worker.room.visual.text(`${bestPairing.rating.toFixed(1)}`, bestPairing.boss.job.site().pos);
    pairings = _.filter(pairings, (wbp : WorkerBossPairing) => { return wbp.boss !== bestPairing.boss && wbp.worker !== bestPairing.worker; });
  }
  while (pairings.length);

  return [ _.filter(bosses, (b : Boss) => { return b.needsWorkers(); }), _.difference(workers, assignedWorkers) ];
}

function assign_workers(bosses: Boss[], workers: Creep[]) : [Boss[], Creep[]] {
  let lazyWorkers = workers;
  let hiringBosses = bosses;

  let numJobsAndWorkers;
  do {
    numJobsAndWorkers = hiringBosses.length + lazyWorkers.length;
    [hiringBosses, lazyWorkers] = assign_best_workers(hiringBosses, lazyWorkers);
  } while (hiringBosses.length && lazyWorkers.length && (hiringBosses.length + lazyWorkers.length < numJobsAndWorkers));

  return [ hiringBosses, lazyWorkers];
}
