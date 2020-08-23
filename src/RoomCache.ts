import Cache from "Cache";



export class RoomCache {

  readonly room: Room;
  private readonly _cache: Cache;

  constructor(room: Room) {
    this._cache = new Cache();
    this.room = room;
    room._cache = this;
  }

  get sources(): Source[] {
    return this._cache.get('sources', () => this.room.find(FIND_SOURCES));
  }

  get towers(): StructureTower[] {
    return this._cache.get('towers', () => this.room.find<StructureTower>(FIND_MY_STRUCTURES,
      { filter: (s) => s.structureType == STRUCTURE_TOWER }));
  }

  get roads(): StructureRoad[] {
    return this._cache.get('roads', () => this.room.find<StructureRoad>(FIND_STRUCTURES,
      { filter: (s) => s.structureType == STRUCTURE_ROAD }));
  }

  get ramparts(): StructureRampart[] {
    return this._cache.get('ramparts', () => this.room.find<StructureRampart>(FIND_STRUCTURES,
      { filter: (s) => s.structureType == STRUCTURE_RAMPART }));
  }

  get constructionSites(): ConstructionSite[] {
    return this._cache.get('cs', () => this.room.find(FIND_MY_CONSTRUCTION_SITES));
  }

  get ownedFlags(): Flag[] {
    return this._cache.get('flags', () => _.filter(Game.flags, (f) => f.name.startsWith(this.room.name)));
  }

  get creeps(): Creep[] {
    return this._cache.get('creeps', () => _.filter(Game.creeps, (c) => {
      if (c.spawning) {
        return false;
      }
      if (c.memory.home) {
        return c.memory.home == this.room.name;
      }
      return (c.room.name === this.room.name);
    }));
  }
}

export default function Room$(room: Room): RoomCache {
  return room._cache;
}
