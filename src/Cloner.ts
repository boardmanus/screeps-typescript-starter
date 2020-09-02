import { Expert } from 'Expert';
import * as Job from 'Job';
import * as Monarchy from 'Monarchy';
import Work from 'Work';
import WorkCloning from 'WorkCloning';
import Executive from 'Executive';
import Boss from 'Boss';
import * as Business from 'Business';
import * as u from 'Utility';
import log from 'ScrupsLogger';
import BusinessEnergyMining from 'BusinessEnergyMining';
import BusinessExploring from 'BusinessExploring';
import BusinessBanking from 'BusinessBanking';
import BusinessCloning from 'BusinessCloning';

const EMPLOYEE_BODY_BASE: BodyPartConstant[] = [MOVE, MOVE, CARRY, WORK];
const EMPLOYEE_BODY_TEMPLATE: BodyPartConstant[] = [WORK, CARRY, MOVE, MOVE];

/*
function is_cloning_structure(s: Structure): boolean {
  return s.isActive && (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN);
}
*/

type CloningStructure = StructureSpawn | StructureExtension;

function max_workers_allowed(_room: Room): number {
  return 8;
}

function get_spawners(room: Room): StructureSpawn[] {
  return room.find<StructureSpawn>(FIND_MY_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_SPAWN });
}

const MIN_SAFE_WORKERS = 3;
const MAX_HEAVY_WORKERS = 6;
const MAX_WORKERS = 8;
const MAX_WORKER_ENERGY = 1500;

export default class Cloner implements Expert {

  private _room: Room;
  private _uniqueId: number;
  private _currentWorkers: Creep[];
  private _numWorkers: number;
  private _maxWorkers: number;
  private _requests: WorkCloning[];

  private getUniqueCreepName(business?: Business.Model): string {
    return `${business?.id() ?? this._room.name}-${this._uniqueId++}`;
  }

  constructor(room: Room) {
    this._room = room;
    this._uniqueId = room.memory.cloneCount || 0;
    this._currentWorkers = this._room.find(FIND_MY_CREEPS);
    this._numWorkers = this._currentWorkers.length;
    this._maxWorkers = 0;
    this._requests = [];
  }

  id(): string {
    return `cloner-${this._room.name}`;
  }

  toString(): string {
    return this.id();
  }

  survey(): void {
    log.debug(`${this} surveying...`);
    // let pendingJobs = find_pending_jobs(this._room.jobs);
    this._maxWorkers = max_workers_allowed(this._room);
  }

  save(): void {
    this._room.memory.cloneCount = this._uniqueId;
  }

  schedule(): Job.Model[] {
    /*
    const sne = get_spawners_and_extensions(this._room);
    const nearlyDeadWorkers = _.sum(_.map(this._currentWorkers, (w: Creep): number => { return (w.ticksToLive && w.ticksToLive < 300) ? 1 : 0; }));
    log.debug(`${this}: ${sne.length} spawners and extensions requiring energy. ${nearlyDeadWorkers} workers nearly dead.`);
    log.debug(`${this} scheduling ${sne.length} clone jobs...`);
    return _.map(
      sne,
      (site: CloningStructure): Job.Model => {
        const basePriority = (site instanceof StructureExtension) ? 4 : 3;
        const workerHealthRatio = (this._numWorkers - nearlyDeadWorkers) / this._maxWorkers;
        return new JobUnload(site, basePriority + (1.0 - workerHealthRatio) * PRIORITY_MULTIPLIER_BY_LEVEL[site.room.controller?.level ?? 0]);
      });
    */
    return [];
  }

  report(): string[] {
    const r = new Array<string>();
    r.push(`*** Cloning report by ${this}`);
    return r;
  }

  cloneRequest(request: Monarchy.CloneRequest): boolean {
    const spawners = _.filter(get_spawners(this._room), (s) => !s.spawning);
    if (spawners.length === 0) {
      return false;
    }

    const availableEnergy = this._room.energyAvailable;
    const totalEnergy = this._room.energyCapacityAvailable;
    const { ceo } = request;
    const employeeBody = ceo.employeeBody(availableEnergy, totalEnergy);
    if (employeeBody.length > 0) {
      log.error(`${this}: clone request accepted! ${request.home}:${request.ceo}`);
      this._requests.push(new WorkCloning(spawners[0], this.getUniqueCreepName(ceo.business), employeeBody, request));
      return true;
    }

    return true;
  }

  clone(ceos: Executive[], bosses: Boss[], lazyWorkers: Creep[], allCreeps: Creep[]): Work[] {

    const spawners = _.filter(get_spawners(this._room), (s) => !s.spawning);
    if (spawners.length === 0) {
      log.debug(`${this}: no spawners for cloning.`);
      return [];
    }

    const availableEnergy = this._room.energyAvailable;
    const totalEnergy = this._room.energyCapacityAvailable;
    if (availableEnergy < 100) {
      log.debug(`${this}: not energy (${availableEnergy}) for cloning.`);
      return [];
    }

    // Start specializing after links have been established.
    const [vacantCeos, usefulCeos] = _.partition(ceos, (ceo) => ceo.needsEmployee());
    const ceosWithVacancies = _.sortBy(vacantCeos, (ceo) => -ceo.priority());
    if (ceosWithVacancies.length) {
      const ceo = ceosWithVacancies[0];
      const employeeBody = ceo.employeeBody(availableEnergy, totalEnergy);
      log.info(`${this}: ${ceosWithVacancies.length} ceo's with vacancies (${ceo})`);
      if (employeeBody.length > 0) {
        const req: Monarchy.CloneRequest = { home: this._room, ceo };
        return [new WorkCloning(spawners[0], this.getUniqueCreepName(ceo.business), employeeBody, req)];
      }
    }

    log.info(`${this}: ${this._requests.length} requests`);
    if (this._requests.length > 0) {
      log.error(`${this}: ${this._requests.length} cloning requests`);
      return _.sortBy(this._requests, (r) => -1 * (r.req?.ceo.priority() ?? 0));
    }

    log.debug(`${this}: ${bosses.length} contract jobs, ${this._numWorkers} workers...`);
    if (lazyWorkers.length > 0) {
      log.debug(`${this}: not cloning => ${lazyWorkers.length} lazy workers present`);
      return [];
    }

    const [harvesters, others1] = _.partition(usefulCeos, (ceo) => ceo.business instanceof BusinessEnergyMining);
    const [scouts, others2] = _.partition(others1, (ceo) => ceo.business instanceof BusinessExploring);
    const [movers] = _.partition(others2, (ceo) => ceo.business instanceof BusinessBanking || ceo.business instanceof BusinessCloning);
    // const [upgraders, fixers] = _.partition(others3, (ceo) => ceo.business instanceof BusinessUpgrading);

    const numScouts = _.sum(scouts, (s) => s.employees().length);
    const numWorkers = allCreeps.length - numScouts;
    const maxWorkers = ((totalEnergy > MAX_WORKER_ENERGY) ? MAX_HEAVY_WORKERS : MAX_WORKERS);
    if ((harvesters.length > 0 && movers.length > 0) || numWorkers >= maxWorkers) {
      log.info(`${this}: not cloning => ${numWorkers} >= ${maxWorkers} workers (t<${allCreeps.length}> - h<${harvesters.length}> - m<${movers}>)`);
      return [];
    }

    const energyToUse = (((harvesters.length < 2 && movers.length === 0)
      || numWorkers < MIN_SAFE_WORKERS) && numWorkers < MAX_WORKERS) ? availableEnergy : totalEnergy;
    const creepBody = u.generate_body(EMPLOYEE_BODY_BASE, EMPLOYEE_BODY_TEMPLATE, Math.min(MAX_WORKER_ENERGY, energyToUse));
    if (creepBody.length === 0) {
      log.debug(`${this}: not enough energy (${availableEnergy}) to clone a creep`);
      return [];
    }

    const cloneTime = u.time_to_spawn(creepBody);
    const replaceableWorkers: Creep[] = this._room.find(FIND_MY_CREEPS, { filter: (c) => !c.ticksToLive || c.ticksToLive <= cloneTime });

    if (this._numWorkers - replaceableWorkers.length >= this._maxWorkers) {
      log.debug(`${this}: got enough workers (${this._numWorkers} - ${replaceableWorkers.length} >= ${this._maxWorkers}) - not cloning`);
      return [];
    }

    return [new WorkCloning(spawners[0], this.getUniqueCreepName(), creepBody)];
  }
}
