import * as Business from 'Business';
import * as Job from "Job";
import JobClaim from 'JobClaim';
import Worker from 'Worker';
import { BuildingWork } from 'Architect';
import { log } from 'ScrupsLogger';
import u from 'Utility';

const EMPLOYEE_BODY_BASE: BodyPartConstant[] = [MOVE, MOVE, CLAIM];

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

function spawn_building_work(room: Room): BuildingWork[] {

  let bestPos: RoomPosition;
  const buildings: BuildingWork[] = [];

  const viableSites = possible_spawn_sites(room);
  log.info(`${room}: ${viableSites.length} viable spawn sites`);
  if (viableSites.length == 0) {
    return [];
  }

  const structs: RoomObject[] = room.find(FIND_SOURCES);
  if (room.controller) {
    structs.push(room.controller)
  }

  const sortedSites = _.sortBy(viableSites, (site: RoomPosition) => {
    return _.sum(_.map(structs, (s) => {
      const d = site.getRangeTo(s);
      return d * d;
    }));
  });

  const style: CircleStyle = { fill: 'purple', radius: 0.3, lineStyle: 'dashed', stroke: 'purple' };
  let i = 0;
  for (const site of sortedSites) {
    style.opacity = (i == 0) ? 1.0 : 0.5 - i / sortedSites.length / 2;
    room.visual.circle(site.x + 2, site.y + 2, style);
    ++i;
  }

  bestPos = sortedSites[0];
  bestPos.x += 2;
  bestPos.y += 2;

  const pstyle: PolyStyle = { fill: 'transparent', stroke: 'purple', lineStyle: 'dashed' };
  room.visual.rect(bestPos.x - 1.5, bestPos.y - 1.5, 5, 5, pstyle)

  buildings.push(new BuildingWork(bestPos, STRUCTURE_SPAWN));

  return buildings;
}

function can_build_spawn(room: Room): boolean {

  const controller = room.controller;
  if (!controller || !controller.my) {
    return false;
  }

  if (u.find_num_building_sites(room, STRUCTURE_SPAWN) > 0) {
    return false;
  }

  return true;
}


export default class BusinessColonizing implements Business.Model {

  static readonly TYPE: string = 'col';
  static readonly FLAG_PREFIX: string = 'claim:';

  static _claimerNum: number = 0;

  static flag_name(room: Room): string {
    return `${BusinessColonizing.FLAG_PREFIX}${room.name}:${BusinessColonizing._claimerNum++}`;
  }

  private readonly _priority: number;
  private readonly _flags: Flag[];
  private readonly _room: Room;
  private readonly _colonizationRooms: Room[];

  constructor(room: Room, priority: number = 5) {
    this._priority = priority;
    this._room = room;

    const flagPrefix = `${BusinessColonizing.FLAG_PREFIX}${room.name}:`;
    this._flags = _.filter(Game.flags, (f) => {
      let valid = f.name.startsWith(flagPrefix);
      if (valid && f.room?.controller?.my && (u.find_num_building_sites(room, STRUCTURE_SPAWN) > 0)) {
        f.remove();
        valid = false;
      }
      return valid;
    });
    this._colonizationRooms = u.map_valid(_.filter(this._flags, (f) => f.room && f.room.name != room.name), (f) => f.room);
    log.error(`${this}: flags=${this._flags}`)
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

  colonizationRooms(): Room[] {
    return this._colonizationRooms;
  }

  canRequestEmployee(): boolean {
    return false;
  }

  needsEmployee(employees: Worker[]): boolean {
    return this._flags.length > employees.length;
  }

  survey() {
  }

  employeeBody(availEnergy: number, maxEnergy: number): BodyPartConstant[] {
    return EMPLOYEE_BODY_BASE;
  }

  permanentJobs(): Job.Model[] {
    const controllers = _.filter(u.map_valid(this._flags, (f) => f.room?.controller),
      (c) => !c.upgradeBlocked && !c.my);

    const jobs = _.map(controllers, (c) => new JobClaim(c));

    return jobs;
  }

  contractJobs(employees: Worker[]): Job.Model[] {
    return [];
  }

  buildings(): BuildingWork[] {
    const work: BuildingWork[] = [];

    _.each(this._flags, (f) => {
      const room = f.room;
      if (room && can_build_spawn(room)) {
        work.push(...spawn_building_work(room));
      }
    });
    return work;
  }
}

Business.factory.addBuilder(BusinessColonizing.TYPE, (id: string): Business.Model | undefined => {
  const frags = id.split('-');
  const room = Game.rooms[frags[2]];
  log.debug(`${BusinessColonizing.TYPE}: room=${room}(${frags[2]}) ${frags}`)
  if (!room) {
    return undefined;
  }

  return new BusinessColonizing(room);
});
