import * as Business from 'Business';
import * as Job from "Job";
import JobScout from 'JobScout';
import { BuildingWork } from 'Architect';
import { log } from 'ScrupsLogger';
import u from 'Utility';
import Room$ from 'RoomCache';

const EMPLOYEE_BODY_BASE: BodyPartConstant[] = [MOVE, MOVE];

export default class BusinessExploring implements Business.Model {

  static readonly TYPE: string = 'explore';
  static readonly FLAG_PREFIX: string = 'scout:';

  static _scoutNum: number = 0;

  static flag_prefix(room: Room): string {
    return `${room.name}:${BusinessExploring.FLAG_PREFIX}`;
  }

  private readonly _priority: number;
  private readonly _flags: Flag[];
  private readonly _room: Room;
  private readonly _remoteRooms: Room[];

  constructor(room: Room, priority: number = 5) {
    this._priority = priority;
    this._room = room;

    const flagPrefix = BusinessExploring.flag_prefix(room);
    this._flags = _.filter(Room$(room).ownedFlags, (f) => {
      let valid = f.name.startsWith(flagPrefix);
      if (valid && f.room && (f.room.find(FIND_MY_SPAWNS).length > 0)) {
        f.remove();
        valid = false;
      }
      return valid;
    });
    this._remoteRooms = u.map_valid(_.filter(this._flags, (f) => f.room && f.room.name != room.name), (f) => f.room);
  }

  id(): string {
    return Business.id(BusinessExploring.TYPE, this._room.name);
  }

  toString(): string {
    return this.id();
  }

  priority(): number {
    return this._priority;
  }

  remoteRooms(): Room[] {
    return this._remoteRooms;
  }

  canRequestEmployee(): boolean {
    return false;
  }

  needsEmployee(employees: Creep[]): boolean {
    return this._flags.length > employees.length;
  }

  survey() {
  }

  employeeBody(availEnergy: number, maxEnergy: number): BodyPartConstant[] {
    return EMPLOYEE_BODY_BASE;
  }

  permanentJobs(): Job.Model[] {
    return _.map(this._flags, (f) => new JobScout(f));
  }

  contractJobs(employees: Creep[]): Job.Model[] {
    return [];
  }

  buildings(): BuildingWork[] {
    return [];
  }
}

Business.factory.addBuilder(BusinessExploring.TYPE, (id: string): Business.Model | undefined => {
  const frags = id.split('-');
  const room = Game.rooms[frags[2]];
  log.debug(`${BusinessExploring.TYPE}: room=${room}(${frags[2]}) ${frags}`)
  if (!room) {
    return undefined;
  }

  return new BusinessExploring(room);
});
