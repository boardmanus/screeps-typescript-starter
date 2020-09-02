/* eslint-disable no-bitwise */
import * as Business from 'Business';
import * as Job from 'Job';
import JobClaim from 'JobClaim';
import WorkBuilding from 'WorkBuilding';
import log from 'ScrupsLogger';
import * as u from 'Utility';
import Room$ from 'RoomCache';
import JobReserve from 'JobReserve';
import { profile } from 'Profiler/Profiler';

const CLAIMER_EMPLOYEE_BODY_BASE: BodyPartConstant[] = [MOVE, CLAIM];
const RESERVER_EMPLOYEE_BODY_BASE: BodyPartConstant[] = [MOVE, MOVE, CLAIM, CLAIM];

function possible_spawn_sites(room: Room) {
  const roomName = room.name;
  const terrain = new Room.Terrain(roomName);
  const sites: RoomPosition[] = [];
  for (let x = 0; x < 45; ++x) {
    for (let y = 0; y < 45; ++y) {
      if (!u.block_has_walls(terrain, x, y, 5)
        && !u.block_has_structures(room, x, y, 5)) {
        const pos = room.getPositionAt(x, y);
        if (pos) sites.push(pos);
      }
    }
  }
  return sites;
}

function spawn_building_work(room: Room): WorkBuilding[] {

  const buildings: WorkBuilding[] = [];

  const viableSites = possible_spawn_sites(room);
  log.info(`${room}: ${viableSites.length} viable spawn sites`);
  if (viableSites.length === 0) {
    return [];
  }

  const structs: RoomObject[] = room.find(FIND_SOURCES);
  if (room.controller) {
    structs.push(room.controller);
  }

  const sortedSites = _.sortBy(viableSites, (site: RoomPosition) => _.sum(_.map(structs, (s) => {
    const d = site.getRangeTo(s);
    return d * d;
  })));

  const style: CircleStyle = { fill: 'purple', radius: 0.3, lineStyle: 'dashed', stroke: 'purple' };
  let i = 0;
  _.each(sortedSites, (site) => {
    style.opacity = (i === 0) ? 1.0 : 0.5 - i / sortedSites.length / 2;
    room.visual.circle(site.x + 2, site.y + 2, style);
    ++i;
  });

  const [bestPos] = sortedSites;
  bestPos.x += 2;
  bestPos.y += 2;

  const pstyle: PolyStyle = { fill: 'transparent', stroke: 'purple', lineStyle: 'dashed' };
  room.visual.rect(bestPos.x - 1.5, bestPos.y - 1.5, 5, 5, pstyle);

  buildings.push(new WorkBuilding(bestPos, STRUCTURE_SPAWN));

  return buildings;
}

function can_build_spawn(room: Room): boolean {

  const { controller } = room;
  if (!controller || !controller.my) {
    return false;
  }

  if (u.find_num_building_sites(room, STRUCTURE_SPAWN) > 0) {
    return false;
  }

  return true;
}

const OP_RESERVE = (1 << 0);
const OP_CLAIM = (1 << 1);

@profile
export default class BusinessColonizing implements Business.Model {

  static readonly TYPE: string = 'col';
  static readonly CLAIM_FLAG_PREFIX: string = 'claim';
  static readonly RESERVE_FLAG_PREFIX: string = 'reserve';

  static _claimerNum = 0;

  private readonly _priority: number;
  private readonly _flags: Flag[];
  private readonly _room: Room;
  private readonly _colonizationRooms: { [roomName: string]: { flag: Flag; ops: number } };
  private _jobs: Job.Model[] | undefined;

  constructor(room: Room, priority = 5) {
    this._priority = priority;
    this._room = room;

    const claimFlagPrefix = `${room.name}:${BusinessColonizing.CLAIM_FLAG_PREFIX}:`;
    const reserveFlagPrefix = `${room.name}:${BusinessColonizing.RESERVE_FLAG_PREFIX}:`;
    this._colonizationRooms = {};

    this._flags = _.filter(Room$(room).ownedFlags, (f) => {
      if (f.room && ((f.room.find(FIND_MY_SPAWNS).length > 0) || !f.room.controller)) {
        f.remove();
        return false;
      }

      const croom = this._colonizationRooms[f.pos.roomName] ?? { flag: f, ops: 0 };
      if (f.name.startsWith(claimFlagPrefix)) {
        croom.ops |= OP_CLAIM;
      }
      if (f.name.startsWith(reserveFlagPrefix)) {
        croom.ops |= OP_RESERVE;
      }

      if (croom.ops !== 0) {
        this._colonizationRooms[f.pos.roomName] = croom;
      }

      return croom.ops !== 0;
    });
  }

  id(): string {
    return Business.id(BusinessColonizing.TYPE, this._room.name);
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
    const keys = Object.keys(this._colonizationRooms);
    if (keys.length < employees.length) {
      return false;
    }

    const requiredEmployees = _.sum(keys, (key) => {
      const cr = this._colonizationRooms[key];
      const controller = cr.flag.room?.controller;
      if ((cr.ops & OP_CLAIM) || !controller) {
        // If claiming, or controller state unknown, allow a
        // new employee
        return 1;
      }

      // If the reservation is less than 500, then we want to a reserver.
      const reservationTime = (controller.reservation?.ticksToEnd ?? 0);
      return (reservationTime < 500) ? 1 : 0;
    });

    return (requiredEmployees > employees.length);
  }

  survey() {
  }

  employeeBody(_availEnergy: number, _maxEnergy: number): BodyPartConstant[] {
    if (_.find(this.permanentJobs(), (j) => j.type() === JobReserve.TYPE)) {
      return RESERVER_EMPLOYEE_BODY_BASE;
    }
    return CLAIMER_EMPLOYEE_BODY_BASE;
  }

  permanentJobs(): Job.Model[] {
    return this._jobs ?? u.map_valid(Object.keys(this._colonizationRooms), (key) => {
      const cr = this._colonizationRooms[key];
      if (cr.ops & OP_CLAIM) {
        const { room } = cr.flag;
        if (!room) {
          return new JobClaim(cr.flag);
        }

        const controller = room.controller!;
        if (controller.upgradeBlocked) {
          return new JobReserve(controller);
        }

        return new JobClaim(controller);
      }
      if (cr.ops & OP_RESERVE) {
        const { room } = cr.flag;
        if (!room) {
          return new JobReserve(cr.flag);
        }

        const controller = room.controller!;
        return new JobReserve(controller);
      }

      return undefined;
    });
  }

  contractJobs(_employees: Creep[]): Job.Model[] {
    return [];
  }

  buildings(): WorkBuilding[] {
    const work: WorkBuilding[] = [];

    _.each(this._colonizationRooms, (cr) => {
      const { room } = cr.flag;
      if (room && can_build_spawn(room)) {
        work.push(...spawn_building_work(room));
      }
    });
    return work;
  }
}
