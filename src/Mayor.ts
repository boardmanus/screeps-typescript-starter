import Architect from 'Architect';
import Caretaker from 'Caretaker';
import Cloner from 'Cloner';
import * as Job from 'Job';
import * as Business from 'Business';
import * as Monarchy from 'Monarchy';
import * as u from 'Utility';
import Work from 'Work';
import WorkTransfer from 'WorkTransfer';
import JobPickup from 'JobPickup';
import JobUnload from 'JobUnload';
import Boss from 'Boss';
import Executive from 'Executive';
import log from 'ScrupsLogger';
import BusinessEnergyMining from 'BusinessEnergyMining';
import BusinessBanking from 'BusinessBanking';
import BusinessConstruction from 'BusinessConstruction';
import BusinessUpgrading from 'BusinessUpgrading';
import BusinessCloning from 'BusinessCloning';
import BusinessExploring from 'BusinessExploring';
import BusinessMineralMining from 'BusinessMineralMining';
import BusinessTrading from 'BusinessTrading';
import BusinessChemistry from 'BusinessChemistry';
import BusinessStripMining from 'BusinessStripMining';
import BusinessDefend from 'BusinessDefend';
import BusinessColonizing from 'BusinessColonizing';
import Room$ from 'RoomCache';
import { profile } from 'Profiler/Profiler';
import Economist from 'Economist';
import CentralCity from 'layout/CentralCity';

function map_valid_to_links(linkers: (Source | StructureStorage)[], to: boolean): StructureLink[] {
  return _.filter(
    u.map_valid(linkers,
      (s: Source | StructureStorage): StructureLink | undefined => ((s._link instanceof StructureLink) ? s._link : undefined)),
    (l: StructureLink) => (to && l.freeSpace() > 100) || (!to && l.cooldown === 0 && l.available() > 100));
}

type ExecutiveMap = { [business: string]: Executive };
type BossMap = { [job: string]: Boss };

/*
function prioritize_bosses(bosses: Boss[]): Boss[] {
  return _.sortBy(bosses, (boss: Boss): number => -boss.priority());
}
*/

type WorkerBossPairing = { rating: number; boss: Boss; worker: Creep };
function get_worker_pairings(bosses: Boss[], workers: Creep[]): WorkerBossPairing[] {
  const pairings: WorkerBossPairing[] = [];
  _.each(bosses, (b: Boss) => {
    _.each(workers, (w: Creep) => {
      const rating = b.priority() * b.job.efficiency(w);
      if (rating > 0.0) {
        pairings.push({ rating, boss: b, worker: w });
      }
    });
  });

  return _.sortBy(pairings, (wbp: WorkerBossPairing) => -wbp.rating);
}

function assign_best_workers(bosses: Boss[], workers: Creep[]): [Boss[], Creep[]] {
  if (bosses.length === 0 || workers.length === 0) {
    log.debug('No bosses or workers!!!');
    return [bosses, workers];
  }

  let pairings: WorkerBossPairing[] = get_worker_pairings(bosses, workers);
  if (pairings.length === 0) {
    log.debug('No pairings!!!');
    return [bosses, workers];
  }

  log.error('Worker-Boss Pairings:');
  _.each(pairings, (p) => log.error(`r:${p.rating}, ${p.boss}, ${p.worker}`));

  const assignedBosses: Boss[] = [];
  const assignedWorkers: Creep[] = [];
  do {
    const bestPairing = pairings[0];
    bestPairing.boss.assignWorker(bestPairing.worker);
    assignedBosses.push(bestPairing.boss);
    assignedWorkers.push(bestPairing.worker);
    bestPairing.worker.room.visual.line(bestPairing.worker.pos, bestPairing.boss.job.site().pos, { width: 0.2, color: 'red', lineStyle: 'dotted' });
    bestPairing.worker.room.visual.text(`${bestPairing.rating.toFixed(1)} `, bestPairing.boss.job.site().pos);
    pairings = _.filter(pairings, (wbp: WorkerBossPairing) => wbp.boss !== bestPairing.boss && wbp.worker !== bestPairing.worker);
    log.error('Refined Worker-Boss Pairings:');
    _.each(pairings, (p) => log.error(`r:${p.rating}, ${p.boss}, ${p.worker}`));
  }
  while (pairings.length);

  return [_.filter(bosses, (b: Boss) => b.needsWorkers()), _.difference(workers, assignedWorkers)];
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

@profile
export default class Mayor implements Monarchy.Model {

  static readonly TYPE = 'mayor';

  private _king: Monarchy.Model;
  private _room: Room;
  private _remoteRooms: Room[];
  private _architect: Architect;
  private _caretaker: Caretaker;
  private _cloner: Cloner;
  private _economist: Economist;
  private _executives: ExecutiveMap;
  private _allBosses: BossMap;
  private _contractBosses: Boss[];
  private _redundantBosses: Boss[];
  private _usefulBosses: Boss[];
  private _allCreeps: Creep[];
  private _lazyWorkers: Creep[];

  addBusiness(business: Business.Model): Executive {
    const id = business.id();
    const ceo = new Executive(business);
    this._executives[id] = ceo;
    return ceo;
  }

  constructor(king: Monarchy.Model, room: Room) {
    this._king = king;
    this._room = room;
    this._remoteRooms = [];
    this._architect = new Architect(room);
    this._caretaker = new Caretaker(room);
    this._cloner = new Cloner(room);
    this._allBosses = {};
    this._executives = {};

    this._allCreeps = Room$(room).creeps;

    this._contractBosses = [];
    this._usefulBosses = [];
    this._redundantBosses = [];
    this._lazyWorkers = [];

    room.layout = CentralCity;

    this.init(king, room);

    this._economist = new Economist(room, Object.values(this._executives));
  }

  init(_king: Monarchy.Model, room: Room): void {

    const exploring = new BusinessExploring(this._room);
    this.addBusiness(exploring);
    this._remoteRooms = exploring.remoteRooms();

    this.addBusiness(new BusinessColonizing(this._room));

    const rooms = [this._room, ...this._remoteRooms];
    _.each(rooms, (r) => {
      _.each(Room$(r).sources, (source) => {
        this.addBusiness(new BusinessEnergyMining(source));
      });

      _.each(r.find(FIND_DEPOSITS), (deposit) => {
        this.addBusiness(new BusinessStripMining(deposit));
      });
    });

    _.each(room.find(FIND_MINERALS), (mineral) => {
      this.addBusiness(new BusinessMineralMining(mineral));
    });

    this.addBusiness(new BusinessCloning(this._room));
    this.addBusiness(new BusinessDefend(this._room, this._remoteRooms));
    this.addBusiness(new BusinessTrading(this._room));

    if (this._room.terminal) {
      this.addBusiness(new BusinessChemistry(this._room));
    }

    if (this._room.controller?.my) {
      this.addBusiness(new BusinessBanking(this._room, this._remoteRooms));
      this.addBusiness(new BusinessUpgrading(this._room.controller));
      this.addBusiness(new BusinessConstruction(this._room.controller, this._remoteRooms));
    }

    // Add all employees of the executives
    _.each(this._allCreeps, (c) => {
      const id = c.memory.business;
      if (!id) {
        return;
      }
      const ceo = this._executives[id];
      if (!ceo) {
        delete c.memory.job;
        return;
      }
      ceo.addEmployee(c);
    });
  }

  id(): string {
    return `mayor-${this._room.name}`;
  }

  type(): string {
    return Mayor.TYPE;
  }

  parent(): Monarchy.Model {
    return this._king;
  }

  cloneRequest(request: Monarchy.CloneRequest): boolean {
    if (request.home === this._room) {
      return false;
    }
    return this._cloner.cloneRequest(request);
  }

  toString(): string {
    return this.id();
  }

  room(): Room {
    return this._room;
  }

  rooms(): Room[] {
    return [this._room, ...this._remoteRooms];
  }

  subSurvey(): void {
    this._architect.survey();
    this._caretaker.survey();
    this._cloner.survey();
  }

  initJobs(): void {
    const ceoBosses = _.flatten(_.map(this._executives, (ceo) => ceo.bosses()));
    _.each(ceoBosses, (b) => { this._allBosses[b.job.id()] = b; });

    const contractJobs = [
      ..._.flatten(_.map(this._executives, (ceo) => ceo.contracts())),
      ...this.pickupJobs(),
      ...this.unloadJobs(),
      ...this._architect.schedule(),
      ...this._cloner.schedule(),
      ...this._caretaker.schedule()];

    _.each(contractJobs, (j) => {
      const boss = this._allBosses[j.id()] ?? new Boss(j);
      this._allBosses[j.id()] = boss;
      this._contractBosses.push(boss);
    });

    log.info(`${this}: ${ceoBosses.length} ceo bosses, and ${contractJobs.length} jobs found while surveying.`);
  }

  initBosses(): void {
    _.each(this._allCreeps, (c) => {

      const lastJobId = c.memory.lastJob;
      if (lastJobId) {
        c.setLastJob(this._allBosses[lastJobId]?.job);
      }

      const jobId = c.memory.job;
      if (!jobId) {
        log.warning(`${this}: no memory of job for ${c}`);
        return;
      }

      const boss = this._allBosses[jobId];
      if (!boss) {
        log.error(`${this}: ${c} has no boss for ${jobId}`);
        c.setJob();
        return;
      }

      if (boss.job.completion(c) >= 1.0) {
        // Clear the job from the creep
        log.info(`${this}: ${c} just completed ${boss.job}`);
        c.setJob();
        c.setLastJob(boss.job);
        return;
      }

      log.debug(`${this}: ${c} continuing ${boss.job}`);
      boss.assignWorker(c);
    });
  }

  assignSurvey(): void {

    _.each(this._executives, (ceo) => {
      if (ceo.canRequestEmployee()) {
        this._king.cloneRequest({ home: this._room, ceo });
      }
      ceo.survey();
    });

    const unemployed: Creep[] = _.filter(this._allCreeps, (worker) => !worker.isEmployed());
    const [employers, noVacancies] = _.partition(this._contractBosses, (e) => e.needsWorkers());
    const lazyWorkers = this.assignWorkers(employers, unemployed);

    log.info(`${this}: ${employers.length} employers`);
    log.info(`${this}: ${noVacancies.length} bosses with no vacancies`);
    log.info(`${this}: ${unemployed.length} unemployed workers (${unemployed})`);
    log.info(`${this}: ${lazyWorkers.length} lazy workers`);

    this._lazyWorkers = lazyWorkers;
  }

  bossesSurvey(): void {
    const [usefulBosses, redundantBosses] = _.partition(this._allBosses, (boss) => boss.hasWorkers() && !boss.jobComplete());
    log.info(`${this}: ${this._usefulBosses.length} bosses, ${this._redundantBosses.length} redundant`);

    this._usefulBosses = usefulBosses;
    this._redundantBosses = redundantBosses;
  }

  survey(): void {

    log.info(`${this}: surveying...`);
    this.subSurvey();
    this.initJobs();
    this.initBosses();

    this.assignSurvey();

    this.bossesSurvey();
    log.info(`${this}: survey complete.`);

    /*
        log.debug(`Top 5 bosses!`)
        _.each(_.take(prioritize_bosses(this._usefulBosses), 5),
        (b) => log.debug(`${b}: p-${b.priority()}, e-${_.map(b.workers(), (w) => b.job.efficiency(w))} @ ${b.job.site()}`));
        log.debug(`Top 5 vacancies!`)
        const employed = _.flatten(_.map(this._usefulBosses, (b) => b.workers()));
        _.each(_.take(prioritize_bosses(this._redundantBosses), 5),
        (b) => log.debug(`${b}: p-${b.priority()}, e-${_.map(unemployed, (w) => b.job.efficiency(w))} @ ${b.job.site()}`));
      */
  }

  work(): Work[] {

    const noWork: Work[] = [];
    const executives = Object.values(this._executives);
    const bosses = this._usefulBosses;

    const allWork: Work[] = noWork.concat(
      // executives,
      bosses,
      this._cloner.clone(executives, bosses.concat(this._redundantBosses), this._lazyWorkers, this._allCreeps),
      this._architect.design([this._room, ...this._remoteRooms], executives),
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

    const toLinks = _.sortBy(map_valid_to_links(linkers, true), (l: StructureLink) => l.available());
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
        transferWork.push(new WorkTransfer(fl, tl, transferAmount));
      });
    });

    return transferWork;
  }

  pickupJobs(): Job.Model[] {
    const allRooms = [this._room, ...this._remoteRooms];

    const scavengeJobs: Job.Model[] = _.flatten(_.map(allRooms, (r) => {
      if (r !== this._room && this._room.find(FIND_HOSTILE_CREEPS).length > 0) {
        return [];
      }
      return _.map(this._room.find(FIND_DROPPED_RESOURCES), (res: Resource) => new JobPickup(res, res.resourceType, 7));
    }));

    const tombstoneJobs: Job.Model[] = _.flatten(_.map(allRooms, (room) => {
      if (room !== this._room && room.find(FIND_HOSTILE_CREEPS).length > 0) { return []; }
      return _.map(room.find(FIND_TOMBSTONES,
        { filter: (t) => t.available() > 0 }),
        (t) => {
          const resource = _.max(Object.keys(t.store), (res: ResourceConstant) => t.store[res]) as ResourceConstant;
          return new JobPickup(t, resource, 5);
        });
    }));

    const ruinJobs: Job.Model[] = _.flatten(_.map(allRooms, (room) => _.map(room.find(FIND_RUINS,
      { filter: (ruin) => ruin.available() > 0 }),
      (ruin) => {
        const resource = _.max(Object.keys(ruin.store), (rc: ResourceConstant) => ruin.store[rc]) as ResourceConstant;
        return new JobPickup(ruin, resource, 5);
      })));

    const linkers: StructureStorage[] = [];
    const { storage } = this._room;
    if (storage) {
      linkers.push(storage);
    }

    const links = u.map_valid(linkers, (s) => ((s._link && s._link instanceof StructureLink) ? s._link : undefined));
    const linkJobs = u.map_valid(links, (link) => {
      const energy = link.available();
      if (energy > 100) {
        const space = link.freeSpace();
        let p = 2;
        if (space < 100) {
          p = 5;
        } else if (space < 300) {
          p = 4;
        } else if (space < 600) {
          p = 3;
        } else {
          p = 2;
        }
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
    const towers = room.find<StructureTower>(FIND_MY_STRUCTURES,
      { filter: (s: AnyStructure) => (s.structureType === STRUCTURE_TOWER) && s.freeSpace() > 300 });
    const foes = room.find(FIND_HOSTILE_CREEPS);
    const unloadJobs: JobUnload[] = _.map(towers, (s: StructureTower): JobUnload => {
      const p = (foes.length) ? 10 : ((s.freeSpace() / s.capacity()) * 5);
      return new JobUnload(s, RESOURCE_ENERGY, p);
    });

    const jobs: JobUnload[] = unloadJobs;
    log.info(`${this} scheduling ${jobs.length} unload jobs (${jobs})...`);
    return jobs;
  }

  report(): string[] {
    const r = new Array<string>();
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

    // this._room.memory.executives = _.map(this._executives, (e) => e.toMemory());
    // this._room.memory.bosses = _.map(this._bosses, (boss) => boss.toMemory());

    log.info(`${this}: saved.`);
  }

  assignWorkers(bosses: Boss[], availableWorkers: Creep[]): Creep[] {

    if (bosses.length === 0 || availableWorkers.length === 0) {
      log.info(`${this}: no bosses or workers to assign.`);
      return [];
    }

    //    const [emptyWorkers, energizedWorkers] = _.partition(availableWorkers, (w: Creep) => { return w.available() === 0; });
    //    const [fullWorkers, multipurposeWorkers] = _.partition(energizedWorkers, (w: Creep) => { return w.freeSpace() === 0; });
    //    const [sourceJobs, sinkJobs] = _.partition(bosses, (b: Boss) => { return b.job.satisfiesPrerequisite(Job.Prerequisite.COLLECT_ENERGY); });

    //    log.info(`${this}: assigning ${fullWorkers.length} full workers to ${sinkJobs.length} sink jobs`);
    // _.each(sinkJobs, (boss) => log.debug(`${boss}: sink job  @ ${boss.job.site()}`))
    //    const [hiringSinks, lazyFull] = assign_workers(sinkJobs, fullWorkers);
    //    log.info(`${this}: assigning ${emptyWorkers.length} empty workers to ${sourceJobs.length} source jobs ${sourceJobs}`);
    // _.each(sourceJobs, (boss) => log.debug(`${boss}: source job @ ${boss.job.site()}`))
    //    const [hiringSources, lazyEmpty] = assign_workers(sourceJobs, emptyWorkers);
    //    log.info(`${this}: assigning ${multipurposeWorkers.length} workers to ${hiringSources.length + hiringSinks.length} left - over jobs`);
    //    const [hiring, lazyMulti] = assign_workers(hiringSinks.concat(hiringSources), multipurposeWorkers);
    // return lazyFull.concat(lazyEmpty, lazyMulti);
    log.error('All bosses:');
    _.each(bosses, (b) => log.error(`${b} => ${b.job.site()}`));
    const [, lazy] = assign_workers(bosses, availableWorkers);
    return lazy;
  }
}
