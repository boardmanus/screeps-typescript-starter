import * as Business from 'Business';
import * as Job from "Job";
import Worker from 'Worker';
import { BuildingWork } from 'Architect';
import u from 'Utility';
import { log } from 'ScrupsLogger';

interface Pos {
  x: number,
  y: number
};


// \\[][]..
// []\\[][]
// [][]\\[]
// ..[][]\\
const LAB_PLACEMENTS: Pos[] = [
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 2, y: 1 },
  { x: 0, y: 1 },
  { x: 0, y: 2 },
  { x: 1, y: 2 },
  { x: 3, y: 1 },
  { x: 3, y: 2 },
  { x: 1, y: 3 },
  { x: 2, y: 3 }
];

function possible_lab_block_sites(terminal: StructureTerminal): RoomPosition[] {
  const room = terminal.room;
  const roomName = room.name;
  const terrain = new Room.Terrain(roomName);
  const sites: RoomPosition[] = [];
  for (let x = 0; x < 46; ++x) {
    for (let y = 0; y < 46; ++y) {
      if (!u.block_has_walls(terrain, x, y, 4)
        && !u.block_has_structures(room, x, y, 4)) {
        const pos = room.getPositionAt(x, y);
        if (pos) sites.push(pos);
      }
    }
  }
  return sites;
}

function num_allowed_labs(room: Room): number {
  const rcl = room.controller?.level ?? 0;
  return (CONTROLLER_STRUCTURES.lab[rcl]);
}
function lab_building_work(room: Room, labs: StructureLab[]): BuildingWork[] {
  const terminal = room.terminal;
  if (!terminal) {
    return [];
  }

  let bestPos: RoomPosition;
  const buildings: BuildingWork[] = [];

  if (labs.length == 0) {
    const viableSites = possible_lab_block_sites(terminal);
    log.info(`${terminal}: ${viableSites.length} viable lab sites`);
    if (viableSites.length == 0) {
      return [];
    }

    const sortedSites = _.sortBy(viableSites, (site: RoomPosition) => {
      const rangeTerminal = site.getRangeTo(terminal.pos);
      const centerPos = room.getPositionAt(24, 24);
      const rangeCenter = centerPos ? site.getRangeTo(centerPos) : 25;
      return rangeTerminal * rangeTerminal + rangeCenter * rangeCenter;
    });

    const style: CircleStyle = { fill: 'purple', radius: 0.3, lineStyle: 'dashed', stroke: 'purple' };
    let i = 0;
    for (const site of sortedSites) {
      style.opacity = (i == 0) ? 1.0 : 0.5 - i / sortedSites.length / 2;
      room.visual.circle(site.x + 1.5, site.y + 1.5, style);
      ++i;
    }

    bestPos = sortedSites[0];

    for (let r = 0; r < 4; ++r) {
      const pos = room.getPositionAt(bestPos.x + r, bestPos.y + r);
      if (pos) {
        buildings.push(new BuildingWork(pos, STRUCTURE_ROAD));
      }
    }
  }
  else {
    bestPos = room.getPositionAt(labs[0].pos.x - 1, labs[0].pos.y) ?? labs[0].pos;
  }

  const pstyle: PolyStyle = { fill: 'transparent', stroke: 'purple', lineStyle: 'dashed' };
  room.visual.rect(bestPos.x - 0.5, bestPos.y - 0.5, 4, 4, pstyle)

  const lstyle: LineStyle = { color: 'purple', lineStyle: 'dashed' };
  room.visual.line(bestPos.x - 0.5, bestPos.y - 0.5, bestPos.x + 3.5, bestPos.y + 3.5, lstyle);

  const numAllowedLabs = num_allowed_labs(room);
  for (let l = labs.length; l < numAllowedLabs; ++l) {
    const pos = room.getPositionAt(bestPos.x + LAB_PLACEMENTS[l].x, bestPos.y + LAB_PLACEMENTS[l].y);
    if (pos) {
      buildings.push(new BuildingWork(pos, STRUCTURE_LAB));
    }
  }
  const roadStyle: CircleStyle = { fill: 'purple', radius: 0.3, lineStyle: 'solid', stroke: 'purple' };
  const labStyle: CircleStyle = { fill: 'purple', radius: 0.3, lineStyle: 'solid', stroke: 'white' };
  _.each(buildings, (b) => {
    room.visual.circle(b.site.x, b.site.y, (b.type == STRUCTURE_ROAD) ? roadStyle : labStyle);
  });

  return buildings;
}

function can_build_labs(room: Room, labs: StructureLab[], cs: ConstructionSite[]) {
  return room.terminal && num_allowed_labs(room) > labs.length + cs.length;
}

function update_labs(labs: StructureLab[]): void {

}

import { profile } from 'Profiler/Profiler'
export default class BusinessChemistry implements Business.Model {

  static readonly TYPE: string = 'chem';

  private readonly _room: Room;
  private readonly _priority: number;
  private readonly _labs: StructureLab[];
  private readonly _labConstruction: ConstructionSite[];

  constructor(chemistryRoom: Room, priority: number = 5) {
    this._room = chemistryRoom;
    this._priority = priority;
    this._labConstruction = chemistryRoom.find(FIND_MY_CONSTRUCTION_SITES, { filter: (cs) => cs.structureType == STRUCTURE_LAB });
    this._labs = chemistryRoom.find<StructureLab>(FIND_MY_STRUCTURES, { filter: (s) => s.structureType == STRUCTURE_LAB });

    if (this._labs.length) {
      update_labs(this._labs);
    }
  }

  id(): string {
    return Business.id(BusinessChemistry.TYPE, this._room.name);
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

  needsEmployee(employees: Worker[]): boolean {
    return false;
  }

  survey() {
  }

  employeeBody(availEnergy: number, maxEnergy: number): BodyPartConstant[] {
    return [];
  }

  permanentJobs(): Job.Model[] {
    // No permanent jobs for chemistry - everything is outsourced.
    return [];
  }

  contractJobs(employees: Worker[]): Job.Model[] {
    if (this._labs.length == 0) {
      return [];
    }

    return [];
  }

  buildings(): BuildingWork[] {

    const work: BuildingWork[] = [];

    if (can_build_labs(this._room, this._labs, this._labConstruction)) {
      work.push(...lab_building_work(this._room, this._labs))
    }

    return work;
  }
}

Business.factory.addBuilder(BusinessChemistry.TYPE, (id: string): Business.Model | undefined => {
  const frags = id.split('-');
  const room = Game.rooms[frags[2]];
  if (!room) {
    return undefined;
  }
  return new BusinessChemistry(room);
});



