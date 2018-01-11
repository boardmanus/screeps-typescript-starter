import { Expert } from "./Expert";
import { City } from "./City";
import { Job } from "./Job";
import { Work } from "./Work";
import { Operation } from "./Operation";
import { JobUnload } from "./JobUnload";
import { log } from "./lib/logger/log";
import u from "./Utility"


type CloningStructure = StructureSpawn|StructureExtension;

function max_workers_allowed(_room : Room) : number {
  return 8;
}

function get_cloning_energy(city : City) : [number, number] {
  return city.getCloningEnergy();
}

function get_spawners(city : City) : StructureSpawn[] {
  return city.room.find<StructureSpawn>(FIND_MY_STRUCTURES, { filter: (s : AnyStructure) =>
    { return s.structureType == STRUCTURE_SPAWN;
  }});
}

function get_spawners_and_extensions(room : Room) : CloningStructure[] {
  return room.find<CloningStructure>(FIND_MY_STRUCTURES, { filter: (s : Structure) => {
    if (s.structureType != STRUCTURE_SPAWN && s.structureType != STRUCTURE_EXTENSION) {
      return false;
    }

    const cs : CloningStructure = <CloningStructure>s;
    return cs.availableEnergy() < cs.energyCapacity;
  }});
}

function clone_a_worker(work : CloningWork) : Operation {
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

class CloningWork implements Work {

  readonly site : StructureSpawn;
  readonly name : string;
  readonly body : BodyPartConstant[];

  constructor(site : StructureSpawn, name : string, body : BodyPartConstant[]) {
    this.site = site;
    this.name = name;
    this.body = body;
  }

  id() {
    return `work-clone-${this.site.id}`;
  }


  toString() : string {
    return this.id();
  }

  priority() : number {
    return 0;
  }

  work() : Operation[] {
    return [ clone_a_worker(this) ];
  }
}

export class Cloner implements Expert {

  private _city: City;
  private _uniqueId : number;
  private _currentWorkers : Creep[];
  private _numWorkers : number;
  private _maxWorkers : number;

  private getUniqueCreepName(job : Job) : string {
    return `${this._city.name}-${job}-${this._uniqueId++}`;
  }

  constructor(city: City) {
    this._city = city;
    this._uniqueId = city.room.memory.cloneCount || 0;
  }

  id() : string {
    return `cloner-${this._city.name}`
  }

  survey() : void {
    log.debug(`${this} surveying...`);
    //let pendingJobs = find_pending_jobs(this._city.jobs);
    this._currentWorkers = this._city.room.find(FIND_MY_CREEPS);
    this._numWorkers = this._currentWorkers.length;
    this._maxWorkers = max_workers_allowed(this._city.room);
  }

  save() : void {
    this._city.room.memory.cloneCount = this._uniqueId;
  }


  schedule() : Job[] {
    log.debug(`${this} scheduling...`);
    const sne = get_spawners_and_extensions(this._city.room);
    log.debug(`${this}: ${sne.length} spawners and extensions requiring energy`);
    const nearlyDeadWorkers = _.sum(_.map(this._currentWorkers, (w : Creep) : number => { return w.ticksToLive < 100? 1 : 0; }));
    return _.map(
      sne,
      (site : CloningStructure) : Job => {
        const priority = 1.0 - (this._numWorkers - nearlyDeadWorkers)/this._maxWorkers;
        return new JobUnload(site, 1 + priority*8);
      });
  }

  report() : string[] {
    let r = new Array<string>();
    r.push(`*** Cloning report by ${this}`);
    return r;
  }

  clone(jobs : Job[]) : Work[] {

    log.debug(`${this}: ${jobs.length} unworked jobs...`)
    let jobIndex = 0;
    let work : Work[] = [];


    if (this._numWorkers >= this._maxWorkers) {
      return work;
    }

    for (const spawner of get_spawners(this._city)) {
      if (jobIndex >= jobs.length) {
        return work;
      }

      const mij = jobs[jobIndex++];
      const [availableEnergy, totalEnergy] = get_cloning_energy(this._city);

      if (this._numWorkers > MIN_SAFE_WORKERS &&
          availableEnergy/totalEnergy < 0.5) {
        return work;
      }

      const creepBody = u.generate_body(mij.baseWorkerBody(), availableEnergy);
      if (creepBody.length == 0) {
        log.debug(`${this}: not enough energy (${availableEnergy}) to clone a creep for ${mij}`);
        return work;
      }

      const creepName : string = this.getUniqueCreepName(mij);
      work.push(new CloningWork(spawner, creepName, creepBody));
    }

    return work;
  }

}
