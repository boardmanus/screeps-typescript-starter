import Cache from 'Cache';

export class RoomCache {

  readonly room: Room;
  private readonly cache: Cache;

  constructor(room: Room) {
    this.cache = new Cache();
    this.room = room;
    room.cache = this;
  }

  get sources(): Source[] {
    return this.cache.get('sources', () => this.room.find(FIND_SOURCES));
  }

  get towers(): StructureTower[] {
    return this.cache.get('towers', () => this.room.find<StructureTower>(FIND_MY_STRUCTURES,
      { filter: (s) => (s.structureType === STRUCTURE_TOWER) }));
  }

  get roads(): StructureRoad[] {
    return this.cache.get('roads', () => this.room.find<StructureRoad>(FIND_STRUCTURES,
      { filter: (s) => s.structureType === STRUCTURE_ROAD }));
  }

  get ramparts(): StructureRampart[] {
    return this.cache.get('ramparts', () => this.room.find<StructureRampart>(FIND_STRUCTURES,
      { filter: (s) => s.structureType === STRUCTURE_RAMPART }));
  }

  get containers(): StructureContainer[] {
    return this.cache.get('containers', () => this.room.find<StructureContainer>(FIND_STRUCTURES,
      { filter: (s) => s.structureType === STRUCTURE_CONTAINER }));
  }

  get constructionSites(): ConstructionSite[] {
    return this.cache.get('cs', () => this.room.find(FIND_MY_CONSTRUCTION_SITES));
  }

  get ownedFlags(): Flag[] {
    return this.cache.get('flags', () => _.filter(Game.flags, (f) => f.name.startsWith(this.room.name)));
  }

  get hostiles(): Creep[] {
    return this.cache.get('hostiles', () => _.filter(this.room.find(FIND_HOSTILE_CREEPS),
      (c) => ((c.getActiveBodyparts(ATTACK) > 0) || (c.getActiveBodyparts(RANGED_ATTACK) > 0))));
  }

  get creeps(): Creep[] {
    return this.cache.get('creeps', () => _.filter(Game.creeps, (c) => {
      if (c.spawning) {
        return false;
      }
      if (c.memory.home) {
        return c.memory.home === this.room.name;
      }
      return (c.room.name === this.room.name);
    }));
  }

}

export default function Room$(room: Room): RoomCache {
  return room.cache;
}
