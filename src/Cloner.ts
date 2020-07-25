import { Expert } from "./Expert";
import * as Job from "Job";
import { Work } from "./Work";
import { Operation } from "./Operation";
import Executive from "Executive";
import Boss from "Boss";
import * as Business from "Business";
import u from "./Utility"
import { log } from './ScrupsLogger'

const EMPLOYEE_BODY_BASE: BodyPartConstant[] = [MOVE, MOVE, CARRY, WORK];
const EMPLOYEE_BODY_TEMPLATE: BodyPartConstant[] = [WORK, CARRY, MOVE, MOVE];

function is_cloning_structure(s: Structure): boolean {
  return s.isActive && (s.structureType == STRUCTURE_EXTENSION || s.structureType == STRUCTURE_SPAWN);
}

type CloningStructure = StructureSpawn | StructureExtension;

function max_workers_allowed(_room: Room): number {
  return 8;
}

function get_spawners(room: Room): StructureSpawn[] {
  return room.find<StructureSpawn>(FIND_MY_STRUCTURES, {
    filter: (s) => s.structureType == STRUCTURE_SPAWN
  });
}

function get_spawners_and_extensions(room: Room): CloningStructure[] {
  return room.find<CloningStructure>(FIND_MY_STRUCTURES, {
    filter: (s) => is_cloning_structure(s) && (s.available() < s.capacity())
  });
}

function clone_a_worker(work: CloningWork): Operation {
  return () => {
    const res = work.site.spawnCreep(work.body, work.name);
    switch (res) {
      case ERR_NOT_OWNER:
      //case ERR_NAME_EXISTS:
      case ERR_NOT_ENOUGH_ENERGY:
      case ERR_INVALID_ARGS:
      case ERR_RCL_NOT_ENOUGH:
      case ERR_BUSY:
      default:
        log.warning(`${work}: failed to spawn creep ${work.name}:${work.body} (${u.errstr(res)})`);
        break;
      case OK:
        log.info(`${work}: started to clone ${work.name}:${work.body}`);
        if (work.ceo) {
          log.info(`${work}: got ${work.name} resume for employee of ${work.ceo}`);
          work.ceo.addEmployeeResume(work.name)
        }
        break;
    }
  }
}

const MIN_SAFE_WORKERS = 3;
const MAX_HEAVY_WORKERS = 5;
const MAX_WORKERS = 5;
const MAX_WORKER_ENERGY = 1500;

class CloningWork implements Work {

  readonly site: StructureSpawn;
  readonly name: string;
  readonly body: BodyPartConstant[];
  readonly ceo: Executive | undefined;

  constructor(site: StructureSpawn, name: string, body: BodyPartConstant[], ceo?: Executive) {
    this.site = site;
    this.name = name;
    this.body = body;
    this.ceo = ceo;
  }

  id() {
    return `work-clone-${this.site.id}`;
  }

  toString(): string {
    return this.id();
  }

  priority(): number {
    return 0;
  }

  work(): Operation[] {
    return [clone_a_worker(this)];
  }
}

const PRIORITY_MULTIPLIER_BY_LEVEL: number[] = [
  20,
  15,
  10,
  8,
  6,
  5,
  5,
  5,
  5,
  5,
  5,
  5,
  5
];

export class Cloner implements Expert {

  private _room: Room;
  private _uniqueId: number;
  private _currentWorkers: Creep[];
  private _numWorkers: number;
  private _maxWorkers: number;

  private getUniqueCreepName(business?: Business.Model): string {
    return `${business?.id() ?? this._room.name}-${this._uniqueId++}`;
  }

  constructor(room: Room) {
    this._room = room;
    this._uniqueId = room.memory.cloneCount || 0;
    this._currentWorkers = this._room.find(FIND_MY_CREEPS);
    this._numWorkers = this._currentWorkers.length;
    this._maxWorkers = 0;
  }

  id(): string {
    return `cloner-${this._room.name}`
  }

  toString(): string {
    return this.id();
  }

  survey(): void {
    log.debug(`${this} surveying...`);
    //let pendingJobs = find_pending_jobs(this._room.jobs);
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
    let r = new Array<string>();
    r.push(`*** Cloning report by ${this}`);
    return r;
  }

  clone(ceos: Executive[], bosses: Boss[], lazyWorkers: Creep[]): Work[] {

    const spawners = _.filter(get_spawners(this._room), (s) => !s.spawning);
    if (spawners.length == 0) {
      log.debug(`${this}: no spawners for cloning.`)
      return [];
    }

    log.debug(`${this}: ${bosses.length} contract jobs, ${this._numWorkers} workers...`)

    const availableEnergy = this._room.energyAvailable;
    const totalEnergy = this._room.energyCapacityAvailable;
    if (availableEnergy < 100) {
      log.debug(`${this}: not energy (${availableEnergy}) for cloning.`);
      return [];
    }

    // Start specializing after links have been established.
    const ceosWithVacancies = _.sortBy(_.filter(ceos, (ceo) => ceo.needsEmployee()), (ceo) => ceo.priority());
    if (ceosWithVacancies.length) {
      log.info(`${this}: ${ceosWithVacancies.length} ceo's with vacancies`);
      const ceo = ceosWithVacancies[0];
      const employeeBody = ceo.employeeBody(availableEnergy, totalEnergy);
      if (employeeBody.length > 0) {
        return [new CloningWork(spawners[0], this.getUniqueCreepName(ceo.business), employeeBody, ceo)];
      }
    }

    if (lazyWorkers.length > 0) {
      log.debug(`${this}: not cloning => ${lazyWorkers.length} lazy workers present`);
      return [];
    }

    const numBossedWorkers = _.sum(bosses, (b) => b.workers().length);
    if (ceosWithVacancies.length > 0 && numBossedWorkers > 2) {
      log.debug(`${this}: not cloning => ${ceosWithVacancies.length} ceos with vacancies, and ${numBossedWorkers} bossed`);
      return [];
    }

    const numEmployees = ceos.length - ceosWithVacancies.length;
    const maxWorkers = ((totalEnergy > MAX_WORKER_ENERGY) ? MAX_HEAVY_WORKERS : MAX_WORKERS) + numEmployees;
    if ((this._numWorkers >= maxWorkers)
      || ((this._numWorkers > MIN_SAFE_WORKERS + numEmployees)
        && availableEnergy < MAX_WORKER_ENERGY
        && availableEnergy / totalEnergy < 0.9)) {
      log.debug(`${this}: not cloning => numWorkers=${this._numWorkers} energy=${availableEnergy}/${totalEnergy}=${availableEnergy / totalEnergy}`)
      return [];
    }

    // Find the most sort after contracts.
    if (bosses.length == 0) {
      log.debug(`${this}: no bosses, no cloney.`);
      return [];
    }
    /*
        const TAXI_JOBS = [JobPickup.TYPE, JobUnload.TYPE];
        const [taxiBosses, workerBosses] = _.partition(bosses, (b) => TAXI_JOBS.includes(b.job.type()));
        const taxiCreeps = _.sum(taxiBosses, (b) => b.numWorkers());
        const workerCreeps = _.sum(workerBosses, (b) => b.numWorkers());
        log.debug(`${this}: ${taxiCreeps} taxis, ${workerCreeps} peons`);

        const taxiRating = taxiBosses.length - taxiCreeps;
        const workerRating = workerBosses.length - workerCreeps;
        const bestRepresentativeJob = (taxiBosses.length > 0 && taxiRating > workerRating) ? taxiBosses[0].job : workerBosses[0].job;
        log.debug(`${this}: taxiRating: ${taxiRating}, workerRating: ${workerRating} => bestJob: ${bestRepresentativeJob}`);
    */
    const creepBody = u.generate_body(EMPLOYEE_BODY_BASE, EMPLOYEE_BODY_TEMPLATE, Math.min(MAX_WORKER_ENERGY, availableEnergy));
    if (creepBody.length == 0) {
      log.debug(`${this}: not enough energy (${availableEnergy}) to clone a creep`);
      return [];
    }

    const cloneTime = u.time_to_spawn(creepBody);
    const replaceableWorkers: Creep[] = this._room.find(FIND_MY_CREEPS, {
      filter: (c) => !c.ticksToLive || c.ticksToLive <= cloneTime
    });

    if (this._numWorkers - replaceableWorkers.length >= this._maxWorkers) {
      log.debug(`${this}: got enough workers (${this._numWorkers} - ${replaceableWorkers.length} >= ${this._maxWorkers}) - not cloning`);
      return [];
    }

    return [new CloningWork(spawners[0], this.getUniqueCreepName(), creepBody)];
  }
}
