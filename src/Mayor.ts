import { Architect } from "./Architect";
import { Caretaker } from "./Caretaker";
import { Cloner } from "./Cloner";
import * as Job from "Job";
import * as Business from "Business";
import { Work } from "./Work";
import JobPickup from "JobPickup";
import JobUnload from "JobUnload";
import Boss from "Boss";
import Executive from "Executive";
import { Operation } from "Operation";
import u from "Utility";
import { log } from 'ScrupsLogger';
import BusinessEnergyMining from "BusinessEnergyMining";
import BusinessBanking from "BusinessBanking";
import BusinessConstruction from "BusinessConstruction";
import BusinessUpgrading from "BusinessUpgrading";
import BusinessCloning from "BusinessCloning";
import BusinessExploring from "BusinessExploring";
import BusinessMineralMining from "BusinessMineralMining";
import BusinessTrading from "BusinessTrading";
import BusinessChemistry from "BusinessChemistry";
import BusinessStripMining from "BusinessStripMining";
import BusinessDefend from "BusinessDefend";
import BusinessColonizing from "BusinessColonizing";

function map_valid_bosses(memory: BossMemory[], jobMap: Job.Map): Boss[] {
  return u.map_valid(
    memory,
    (memory: BossMemory): Boss | undefined => {
      const boss = Boss.fromMemory(memory, jobMap);
      return boss;
    });
}

function map_valid_executives(memory: ExecutiveMemory[], businessMap: Business.Map): Executive[] {
  return u.map_valid(
    memory,
    (executive: ExecutiveMemory): Executive | undefined => { return Executive.fromMemory(executive, businessMap); });
}

function map_valid_to_links(linkers: (Source | StructureStorage)[], to: boolean): StructureLink[] {
  return _.filter(
    u.map_valid(linkers,
      (s: Source | StructureStorage): StructureLink | undefined => (s._link instanceof StructureLink) ? s._link : undefined),
    (l: StructureLink) => (to && l.freeSpace() > 100) || (!to && l.cooldown == 0 && l.available() > 100));
}

class TransferWork implements Work {

  readonly from: StructureLink;
  readonly to: StructureLink;
  readonly amount: number;

  constructor(from: StructureLink, to: StructureLink, amount: number) {
    this.from = from;
    this.to = to;
    this.amount = amount;
  }

  id() {
    return `work-transfer-${this.from}-${this.to}`;
  }

  toString(): string {
    return this.id();
  }

  priority(): number {
    return 0;
  }

  work(): Operation[] {
    return [() => {
      const res = this.from.transferEnergy(this.to, this.amount);
      switch (res) {
        case OK:
          log.info(`${this}: transfered ${this.amount} of energy from ${this.from} to ${this.to}`);
          break;
        default:
          log.error(`${this}: failed to transfer energy from ${this.from} to ${this.to}(${u.errstr(res)})`);
          break;
      }
    }];
  }
}

export class Mayor {

  private _room: Room;
  private _remoteRooms: Room[];
  private _architect: Architect;
  private _caretaker: Caretaker;
  private _cloner: Cloner;
  private _jobMap: Job.Map;
  private _businessMap: Business.Map;
  private _executives: Executive[];
  private _bosses: Boss[];
  private _redundantBosses: Boss[];
  private _allCreeps: Creep[];
  private _lazyWorkers: Creep[];

  constructor(room: Room) {
    this._room = room;
    this._remoteRooms = [];
    this._architect = new Architect(room);
    this._caretaker = new Caretaker(room);
    this._cloner = new Cloner(room);
    this._bosses = [];
    this._allCreeps = _.filter(Game.creeps, (c) => {
      if (c.spawning) {
        return false;
      }
      if (c.memory.home) {
        return c.memory.home == room.name;
      }
      return (c.room.name === room.name);
    });

    this._redundantBosses = [];
    this._lazyWorkers = [];

    this._jobMap = {};
    this._businessMap = {};

    const exploring = new BusinessExploring(this._room);
    this._remoteRooms = exploring.remoteRooms();
    this._businessMap[exploring.id()] = exploring;

    const colonizing = new BusinessColonizing(this._room);
    this._businessMap[colonizing.id()] = colonizing;


    const rooms = [this._room, ...this._remoteRooms];
    for (const room of rooms) {
      _.each(room.find(FIND_SOURCES), (source) => {
        const mining = new BusinessEnergyMining(source);
        this._businessMap[mining.id()] = mining;
      });

      _.each(room.find(FIND_DEPOSITS), (deposit) => {
        const mining = new BusinessStripMining(deposit);
        this._businessMap[mining.id()] = mining;
      });
    }

    _.each(room.find(FIND_MINERALS), (mineral) => {
      const mining = new BusinessMineralMining(mineral);
      this._businessMap[mining.id()] = mining;
    });

    const cloningBusiness = new BusinessCloning(this._room);
    this._businessMap[cloningBusiness.id()] = cloningBusiness;

    const defendingBusiness = new BusinessDefend(this._room, this._remoteRooms);
    this._businessMap[defendingBusiness.id()] = defendingBusiness;

    const tradingBusiness = new BusinessTrading(this._room);
    this._businessMap[tradingBusiness.id()] = tradingBusiness;

    if (this._room.terminal) {
      const chemBusiness = new BusinessChemistry(this._room);
      this._businessMap[chemBusiness.id()] = chemBusiness;
    }

    if (this._room.storage) {
      const banking = new BusinessBanking(this._room, this._remoteRooms);
      this._businessMap[banking.id()] = banking;
    }

    if (this._room.controller?.my) {
      const upgrading = new BusinessUpgrading(this._room.controller);
      this._businessMap[upgrading.id()] = upgrading;

      const construction = new BusinessConstruction(this._room.controller, this._remoteRooms);
      this._businessMap[construction.id()] = construction;
    }

    this._executives = map_valid_executives(room.memory.executives, this._businessMap);
  }

  id(): string {
    return `mayor-${this._room.name}`;
  }

  toString(): string {
    return this.id();
  }

  work(): Work[] {

    const noWork: Work[] = [];

    const allWork: Work[] = noWork.concat(
      this._executives,
      this._bosses,
      this._cloner.clone(this._executives, this._bosses.concat(this._redundantBosses), this._lazyWorkers, this._allCreeps),
      this._architect.design([this._room, ...this._remoteRooms], this._executives),
      this._caretaker.repair(),
      this.transferEnergy());

    log.info(`${this}: ${allWork.length} units of work created`);
    return _.sortBy(allWork, (work) => -work.priority());
  }

  private transferEnergy(): Work[] {
    const room = this._room;
    const fromLinks = map_valid_to_links(room.find(FIND_SOURCES), false);

    const linkers: StructureStorage[] = [];
    if (room.storage) {
      linkers.push(room.storage);
    }

    const toLinks = _.sortBy(map_valid_to_links(linkers, true), (l: StructureLink) => { return l.available(); });
    log.info(`${this}: transfer energy from ${fromLinks.length} links to ${toLinks.length} others`);

    const transferWork: Work[] = [];
    _.each(fromLinks, (fl: StructureLink) => {
      let amountAvailable = fl.available();
      if (amountAvailable < 100) {
        return;
      }

      _.each(toLinks, (tl: StructureLink) => {
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

  survey(): void {

    log.info(`${this}: surveying...`);
    this._architect.survey();
    this._caretaker.survey();
    this._cloner.survey();

    const unmannedBusinesses = _.filter(this._businessMap, (b) => _.every(this._executives, (e) => e.business.id() != b.id()))
    const newExecutives = _.map(unmannedBusinesses, (b) => new Executive(b));
    log.debug(`${this}: ${this._executives.length} executives after survey (${this._executives.length} old, ${newExecutives.length} new)`);
    this._executives.push(...newExecutives);
    for (const ceo of this._executives) {
      ceo.survey();
    }

    const allJobs: Job.Model[] = [
      ..._.flatten(_.map(this._executives, (ceo) => ceo.contracts())),
      ...this.pickupJobs(),
      ...this.unloadJobs(),
      ...this._architect.schedule(),
      ...this._cloner.schedule(),
      ...this._caretaker.schedule()];

    _.each(allJobs, (j) => this._jobMap[j.id()] = j);
    log.info(`${this}: ${allJobs.length} jobs found while surveying.`);

    // Create a boss for every job that doesn't have one.
    const existingBosses = map_valid_bosses(this._room.memory.bosses, this._jobMap);
    const newJobs = _.filter(allJobs, (job) => _.every(existingBosses, (boss) => boss.job.id() != job.id()));
    const newBosses = _.map(newJobs, (job) => new Boss(job));
    log.info(`${this}: ${existingBosses.length} old bosses, and ${newBosses.length} new `);

    if (Game.time % 1) {
      log.info(`${this}: surveying in ${Game.time % 10} `);
      return;
    }

    const unemployed: Creep[] = _.filter(this._allCreeps, (worker) => !worker.isEmployed());
    const allBosses = existingBosses.concat(newBosses);
    const [employers, noVacancies] = _.partition(allBosses, (b: Boss) => b.needsWorkers());
    const lazyWorkers = this.assignWorkers(employers, unemployed);

    log.info(`${this}: ${employers.length} employers`);
    log.info(`${this}: ${unemployed.length} unemployed workers`);
    log.info(`${this}: ${lazyWorkers.length} lazy workers`);
    const [usefulBosses, redundantBosses] = _.partition(allBosses, (boss: Boss) => { return boss.hasWorkers() && !boss.jobComplete(); });
    log.info(`${this}: ${usefulBosses.length} bosses, ${redundantBosses.length} redundant`);
    this._bosses = usefulBosses;
    this._lazyWorkers = lazyWorkers;
    this._redundantBosses = redundantBosses;

    log.debug(`Top 5 bosses!`)
    _.each(_.take(prioritize_bosses(this._bosses), 5), (b) => log.debug(`${b}: p-${b.priority()}, e-${_.map(b.workers(), (w) => b.job.efficiency(w))} @ ${b.job.site()}`));
    log.debug(`Top 5 vacancies!`)
    const employed = _.flatten(_.map(this._bosses, (b) => b.workers()));
    _.each(_.take(prioritize_bosses(this._redundantBosses), 5), (b) => log.debug(`${b}: p-${b.priority()}, e-${_.map(unemployed, (w) => b.job.efficiency(w))} @ ${b.job.site()}`));
  }

  pickupJobs(): Job.Model[] {
    const room = this._room;
    const allRooms = [room, ...this._remoteRooms];

    const scavengeJobs: Job.Model[] = _.flatten(_.map(allRooms, (room) => {
      return _.map(room.find(FIND_DROPPED_RESOURCES), (r: Resource) => new JobPickup(r, r.resourceType, 7));
    }));
    _.each(scavengeJobs, (t) => log.debug(`${this}: ${t} holding=${t.site().available()}, free=${t.site().freeSpace()}, cap=${t.site().capacity()}, a=${t.site().available()}`));

    const tombstoneJobs: Job.Model[] = _.flatten(_.map(allRooms, (room) => {
      return _.map(room.find(FIND_TOMBSTONES,
        { filter: (t) => t.available() > 0 }),
        (t) => {
          const resource = <ResourceConstant>_.max(Object.keys(t.store), (r: ResourceConstant) => { return t.store[r]; });
          return new JobPickup(t, resource, 5);
        });
    }));
    _.each(tombstoneJobs, (t) => log.debug(`${this}: ${t} holding=${t.site().available()}, free=${t.site().freeSpace()}, cap=${t.site().capacity()}, a=${t.site().available()}`));

    const ruinJobs: Job.Model[] = _.flatten(_.map(allRooms, (room) => {
      return _.map(room.find(FIND_RUINS,
        { filter: (r) => r.available() > 0 }),
        (r) => {
          const resource = <ResourceConstant>_.max(Object.keys(r.store), (rc: ResourceConstant) => { return r.store[rc]; });
          return new JobPickup(r, resource, 5);
        });
    }));
    _.each(ruinJobs, (t) => log.debug(`${this}: ${t} holding=${t.site().available()}, free=${t.site().freeSpace()}, cap=${t.site().capacity()}, a=${t.site().available()}`));

    const linkers: StructureStorage[] = [];
    const storage = room.storage;
    if (storage) {
      linkers.push(storage);
    }

    const links = u.map_valid(linkers, (s) => (s._link && s._link instanceof StructureLink) ? s._link : undefined);
    const linkJobs = u.map_valid(links, (link) => {
      const energy = link.available();
      if (energy > 100) {
        const space = link.freeSpace();
        const p = (
          (space < 100) ? 5
            : (space < 300) ? 4
              : (space < 600) ? 3
                : 2);

        return new JobPickup(link, RESOURCE_ENERGY, p);
      }

      return null;
    });

    const jobs = scavengeJobs.concat(linkJobs, tombstoneJobs, ruinJobs);
    log.info(`${this} scheduling ${jobs.length} pickup jobs...`);
    return jobs;
  }

  unloadJobs(): Job.Model[] {
    const room = this._room;
    const towers = room.find<StructureTower>(FIND_MY_STRUCTURES, {
      filter: (s: AnyStructure) => {
        return (s.structureType == STRUCTURE_TOWER) && s.freeSpace() > 300;
      }
    });
    const foes = room.find(FIND_HOSTILE_CREEPS);
    const unloadJobs: JobUnload[] = _.map(towers, (s: StructureTower): JobUnload => {
      const p = (foes.length) ? 10 : (s.freeSpace() / s.capacity() * 5);
      return new JobUnload(s, RESOURCE_ENERGY, p);
    });

    const jobs: JobUnload[] = unloadJobs;
    log.info(`${this} scheduling ${jobs.length} unload jobs (${jobs})...`);
    return jobs;
  }

  report(): string[] {
    let r = new Array<string>();
    r.push(`** Mayoral report by ${this} `);
    r.concat(this._architect.report());
    r.concat(this._cloner.report());
    r.concat(this._caretaker.report());
    return r;
  }

  save(): void {
    this._architect.save();
    this._cloner.save();
    this._caretaker.save();

    this._room.memory.executives = _.map(this._executives, (e) => e.toMemory());
    this._room.memory.bosses = _.map(this._bosses, (boss) => boss.toMemory());

    log.info(`${this}: saved.`)
  }

  assignWorkers(bosses: Boss[], availableWorkers: Creep[]): Creep[] {

    if (bosses.length == 0 || availableWorkers.length == 0) {
      log.info(`${this}: no bosses or workers to assign.`)
      return [];
    }

    //    const [emptyWorkers, energizedWorkers] = _.partition(availableWorkers, (w: Creep) => { return w.available() == 0; });
    //    const [fullWorkers, multipurposeWorkers] = _.partition(energizedWorkers, (w: Creep) => { return w.freeSpace() == 0; });
    //    const [sourceJobs, sinkJobs] = _.partition(bosses, (b: Boss) => { return b.job.satisfiesPrerequisite(Job.Prerequisite.COLLECT_ENERGY); });

    //    log.info(`${this}: assigning ${fullWorkers.length} full workers to ${sinkJobs.length} sink jobs`);
    //_.each(sinkJobs, (boss) => log.debug(`${boss}: sink job  @ ${boss.job.site()}`))
    //    const [hiringSinks, lazyFull] = assign_workers(sinkJobs, fullWorkers);
    //    log.info(`${this}: assigning ${emptyWorkers.length} empty workers to ${sourceJobs.length} source jobs ${sourceJobs}`);
    //_.each(sourceJobs, (boss) => log.debug(`${boss}: source job @ ${boss.job.site()}`))
    //    const [hiringSources, lazyEmpty] = assign_workers(sourceJobs, emptyWorkers);
    //    log.info(`${this}: assigning ${multipurposeWorkers.length} workers to ${hiringSources.length + hiringSinks.length} left - over jobs`);
    //    const [hiring, lazyMulti] = assign_workers(hiringSinks.concat(hiringSources), multipurposeWorkers);
    //return lazyFull.concat(lazyEmpty, lazyMulti);
    const [hiring, lazy] = assign_workers(bosses, availableWorkers);
    return lazy;
  }
}

function prioritize_bosses(bosses: Boss[]): Boss[] {
  return _.sortBy(bosses, (boss: Boss): number => { return -boss.priority(); });
}

type WorkerBossPairing = { rating: number, boss: Boss, worker: Creep };
function get_worker_pairings(bosses: Boss[], workers: Creep[]): WorkerBossPairing[] {
  const pairings: WorkerBossPairing[] = [];
  _.each(bosses, (b: Boss) => {
    _.each(workers, (w: Creep) => {
      const rating = b.priority() * b.job.efficiency(w);
      if (rating > 0.0) {
        pairings.push({ rating: rating, boss: b, worker: w })
      }
    });
  });

  return _.sortBy(pairings, (wbp: WorkerBossPairing) => -wbp.rating);
}

function assign_best_workers(bosses: Boss[], workers: Creep[]): [Boss[], Creep[]] {
  if (bosses.length == 0 || workers.length == 0) {
    log.debug(`No bosses or workers!!!`)
    return [bosses, workers];
  }

  let pairings: WorkerBossPairing[] = get_worker_pairings(bosses, workers);
  if (pairings.length == 0) {
    log.debug(`No pairings!!!`)
    return [bosses, workers];
  }

  //log.debug(`Worker-Boss Pairings:`)
  //_.each(pairings, (p) => log.debug(`r:${p.rating}, ${p.boss}, ${p.worker}`));

  const assignedBosses: Boss[] = [];
  const assignedWorkers: Creep[] = [];
  let bestPairing: WorkerBossPairing;
  do {
    bestPairing = pairings[0];
    bestPairing.boss.assignWorker(bestPairing.worker);
    assignedBosses.push(bestPairing.boss);
    assignedWorkers.push(bestPairing.worker);
    bestPairing.worker.room.visual.line(bestPairing.worker.pos, bestPairing.boss.job.site().pos, { width: 0.2, color: 'red', lineStyle: 'dotted' });
    bestPairing.worker.room.visual.text(`${bestPairing.rating.toFixed(1)} `, bestPairing.boss.job.site().pos);
    pairings = _.filter(pairings, (wbp: WorkerBossPairing) => { return wbp.boss !== bestPairing.boss && wbp.worker !== bestPairing.worker; });
    //log.debug(`Refined Worker-Boss Pairings:`)
    //_.each(pairings, (p) => log.debug(`r:${p.rating}, ${p.boss}, ${p.worker}`));
  }
  while (pairings.length);

  return [_.filter(bosses, (b: Boss) => { return b.needsWorkers(); }), _.difference(workers, assignedWorkers)];
}

function assign_workers(bosses: Boss[], workers: Creep[]): [Boss[], Creep[]] {
  let lazyWorkers = workers;
  let hiringBosses = bosses;

  let numJobsAndWorkers;
  do {
    numJobsAndWorkers = hiringBosses.length + lazyWorkers.length;
    [hiringBosses, lazyWorkers] = assign_best_workers(hiringBosses, lazyWorkers);
  } while (hiringBosses.length && lazyWorkers.length && (hiringBosses.length + lazyWorkers.length < numJobsAndWorkers));

  return [hiringBosses, lazyWorkers];
}
