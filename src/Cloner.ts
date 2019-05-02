import { Expert } from "./Expert";
import { Job } from "./Job";
import { Work } from "./Work";
import { Operation } from "./Operation";
import { JobUnload } from "./JobUnload";
import { log } from "./lib/logger/log";
import u from "./Utility"


type CloningStructure = StructureSpawn | StructureExtension;

function get_cloning_energy_sites(room: Room): Structure[] {
  return room.find<Structure>(FIND_MY_STRUCTURES, {
    filter: (s: Structure) => {
      return (s.structureType == STRUCTURE_EXTENSION || s.structureType == STRUCTURE_SPAWN);
    }
  });
}

function max_workers_allowed(_room: Room): number {
  return 8;
}

function get_cloning_energy(room: Room): [number, number] {
  return _.reduce(
    get_cloning_energy_sites(room),
    (energy: [number, number], site: Structure): [number, number] => {
      return [energy[0] + site.available(), energy[1] + site.capacity()];
    },
    [0, 0]);
}

function get_spawners(room: Room): StructureSpawn[] {
  return room.find<StructureSpawn>(FIND_MY_STRUCTURES, {
    filter: (s: AnyStructure) => {
      return s.structureType == STRUCTURE_SPAWN;
    }
  });
}

function get_spawners_and_extensions(room: Room): CloningStructure[] {
  return room.find<CloningStructure>(FIND_MY_STRUCTURES, {
    filter: (s: Structure) => {
      if (s.structureType != STRUCTURE_SPAWN && s.structureType != STRUCTURE_EXTENSION) {
        return false;
      }

      const cs: CloningStructure = <CloningStructure>s;
      return cs.available() < cs.energyCapacity;
    }
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
        break;
    }
  }
}

const MIN_SAFE_WORKERS = 3;
const MAX_HEAVY_WORKERS = 5;
const MAX_WORKERS = 8;
const MAX_WORKER_ENERGY = 1200;

class CloningWork implements Work {

  readonly site: StructureSpawn;
  readonly name: string;
  readonly body: BodyPartConstant[];

  constructor(site: StructureSpawn, name: string, body: BodyPartConstant[]) {
    this.site = site;
    this.name = name;
    this.body = body;
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

export class Cloner implements Expert {

  private _room: Room;
  private _uniqueId: number;
  private _currentWorkers: Creep[];
  private _numWorkers: number;
  private _maxWorkers: number;

  private getUniqueCreepName(job?: Job): string {
    return `${this._room.name}-${this._uniqueId++}`;
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

  schedule(): Job[] {
    const sne = get_spawners_and_extensions(this._room);
    const nearlyDeadWorkers = _.sum(_.map(this._currentWorkers, (w: Creep): number => { return (w.ticksToLive && w.ticksToLive < 300) ? 1 : 0; }));
    log.debug(`${this}: ${sne.length} spawners and extensions requiring energy. ${nearlyDeadWorkers} workers nearly dead.`);
    log.debug(`${this} scheduling ${sne.length} clone jobs...`);
    return _.map(
      sne,
      (site: CloningStructure): Job => {
        const workerHealthRatio = (this._numWorkers - nearlyDeadWorkers) / this._maxWorkers;
        return new JobUnload(site, 4 + (1.0 - workerHealthRatio) * 6);
      });
  }

  report(): string[] {
    let r = new Array<string>();
    r.push(`*** Cloning report by ${this}`);
    return r;
  }

  private bodyTemplate(job?: Job): BodyPartConstant[] {

    if (job) {
      return job.baseWorkerBody();
    }

    //if (this._room.getRoadsEstablished()) {
    // Don't need the extra move
    //  return [ WORK, MOVE, CARRY ];
    //}

    return [WORK, MOVE, CARRY, MOVE]
  }

  clone(jobs: Job[]): Work[] {

    log.debug(`${this}: ${jobs.length} unworked jobs, ${this._numWorkers} workers...`)

    // Start specializing after links have been established.
    const links = this._room.find(FIND_MY_STRUCTURES, { filter: (s: Structure) => { return s.structureType == STRUCTURE_LINK; } });
    const specialize = (links.length > 2);

    const spawners = _.filter(get_spawners(this._room), (s: StructureSpawn) => {
      return !s.spawning;
    });

    if (spawners.length == 0) {
      return [];
    }

    let [availableEnergy, totalEnergy] = get_cloning_energy(this._room);
    if (this._numWorkers >= MAX_WORKERS
      || (this._numWorkers >= MAX_HEAVY_WORKERS
        && totalEnergy >= MAX_WORKER_ENERGY)
      || (this._numWorkers > MIN_SAFE_WORKERS
        && availableEnergy < MAX_WORKER_ENERGY
        && availableEnergy / totalEnergy < 0.9)) {
      log.debug(`${this}: not cloning => numWorkers=${this._numWorkers} energy=${availableEnergy}/${totalEnergy}=${availableEnergy / totalEnergy}`)
      return [];
    }

    const creepBody = u.generate_body(this.bodyTemplate(), Math.min(MAX_WORKER_ENERGY, availableEnergy));
    if (creepBody.length == 0) {
      log.debug(`${this}: not enough energy (${availableEnergy}) to clone a creep`);
      return [];
    }

    const cloneTime = u.time_to_spawn(creepBody);
    const replaceableWorkers: Creep[] = this._room.find(FIND_MY_CREEPS, {
      filter: (c: Creep) => {
        return !c.ticksToLive || c.ticksToLive <= cloneTime;
      }
    });

    if (this._numWorkers - replaceableWorkers.length >= this._maxWorkers) {
      return [];
    }

    const creepName: string = this.getUniqueCreepName();

    return [new CloningWork(spawners[0], creepName, creepBody)];
  }
}
