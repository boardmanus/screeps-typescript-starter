import * as Business from 'Business';
import * as Job from "Job";
import JobAttack from 'JobAttack';
import { BuildingWork } from 'Architect';
import { log } from 'ScrupsLogger';
import { profile } from 'Profiler/Profiler'


const DEFENDER_EMPLOYEE_BODY: BodyPartConstant[] = [
  TOUGH, TOUGH, TOUGH, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK
];


function tower_power(tower: StructureTower, site: RoomObject, max: number): number {
  const d = tower.pos.getRangeTo(site);
  if (d <= TOWER_OPTIMAL_RANGE) {
    return max;
  }
  else if (d >= TOWER_FALLOFF_RANGE) {
    return max / 4;
  }

  return max / 4 + (3 * max / 4) * (TOWER_FALLOFF_RANGE - d) / (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE);
}

function attack_power(tower: StructureTower, site: Creep): number {
  return tower_power(tower, site, TOWER_POWER_ATTACK);
}

function repair_power(tower: StructureTower, site: Structure): number {
  return tower_power(tower, site, TOWER_POWER_REPAIR);
}

function attacker_priority(attacker: Creep): number {
  return 5;
}

@profile
export default class BusinessDefend implements Business.Model {

  static readonly TYPE: string = 'def';

  private readonly _priority: number;
  readonly _room: Room;
  readonly _remoteRooms: Room[];
  readonly _attackers: Creep[];
  readonly _recyclers: StructureSpawn[];

  constructor(room: Room, remoteRooms: Room[], priority: number = 7) {
    this._priority = priority;
    this._room = room;
    this._remoteRooms = remoteRooms;

    this._recyclers = room.find(FIND_MY_SPAWNS, { filter: (s) => s.isActive && s.recycler() });

    this._attackers = room.find(FIND_HOSTILE_CREEPS);
    this._attackers.push(..._.flatten(_.map(remoteRooms, (room) => room.find(FIND_HOSTILE_CREEPS))));
  }

  id(): string {
    return Business.id(BusinessDefend.TYPE, this._room.name);
  }

  toString(): string {
    return this.id();
  }

  priority(): number {
    return this._priority;
  }

  canRequestEmployee(): boolean {
    return false;
  }

  needsEmployee(employees: Creep[]): boolean {
    return this._attackers.length > 0 && employees.length == 0;
    //return (employees.length < this._attackers.length);
  }

  survey() {
  }

  employeeBody(availEnergy: number, maxEnergy: number): BodyPartConstant[] {
    return DEFENDER_EMPLOYEE_BODY;
  }

  permanentJobs(): Job.Model[] {

    const jobs: Job.Model[] = [];

    log.debug(`${this}: ${this._room} has ${this._attackers.length} attackers!`);

    _.each(this._attackers, (a) => jobs.push(new JobAttack(a, attacker_priority(a))));
    /*
        if (this._recyclers.length > 0) {
          jobs.push(new JobRecycle(this._recyclers[0]));
        }
    */
    return jobs;
  }

  contractJobs(employees: Creep[]): Job.Model[] {
    return []
  }

  buildings(): BuildingWork[] {
    return []
  }
}

Business.factory.addBuilder(BusinessDefend.TYPE, (id: string): Business.Model | undefined => {
  const frags = id.split('-');
  const room = <Room>Game.rooms[frags[2]];
  if (!room) {
    return undefined;
  }
  return new BusinessDefend(room, []);
});


