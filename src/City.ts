import { Mayor } from "./Mayor";
import { log } from "./lib/logger/log";

//import { Job } from "./Job";
//import { Operation } from "./Operation";
//import { JobFactory } from "./Job";
/*
function find_expats(room : Room) : Creep[] {
  return _.reduce(
    room.memory.expats,
    (expats : Creep[], id : string) : Creep[] => {
      const expat = Game.getObjectById<Creep>(id);
      if (expat) expats.push();
      return expats;
    },
    []);
}

function find_locals(room : Room) : Creep[] {
  return room.find(
    FIND_MY_CREEPS, {
      filter: (worker : Creep) => {
        return (!worker.memory.homeTown || worker.memory.homeTown == room.name);
      }
    });
}
/*
function find_lazy_workers(workers : Creep[]) : Creep[] {
  return _.select(workers, (worker : Creep) => { return !worker.memory.job; });
}

function find_busy_workers(workers : Creep[]) : Creep[] {
  return _.select(workers, (worker : Creep) => { return worker.memory.job; });
}

function find_worked_jobs(workers : Creep[]) : Job[] {
  return _.map(
    workers,
    (worker : Creep) : Job => {
      return JobFactory.build(`${worker.memory.job}-${worker.id}`);
    });
}
*/


export class City {
  private _room : Room;
  private _mayor : Mayor;

  constructor(room : Room) {
    this._room = room;
    log.debug(`Constructing ${this}`);
    log.debug(`${this} : room=${room.name}`)

    if (!room.memory.expats) room.memory.expats = [];


    this._mayor = new Mayor(this);
  }

  id() : string {
    return `city-${this.name}`;
  }

  toString() : string {
    return this.id();
  }

  get name() : String { return this._room.name; }
  get memory() : RoomMemory { return this._room.memory; }
  get room() : Room { return this._room; }
  get mayor() : Mayor { return this._mayor; }
}
