import { throws } from "assert";



export class RoomCache {

  readonly room: Room;

  private _sources: Source[] | undefined;
  private _towers: StructureTower[] | undefined;
  private _roads: StructureRoad[] | undefined;
  private _ramparts: StructureRampart[] | undefined;
  private _constructionSites: ConstructionSite[] | undefined;
  private _ownedFlags: Flag[] | undefined;
  private _creeps: Creep[] | undefined;

  constructor(room: Room) {
    this.room = room;
    room._cache = this;
  }

  get sources(): Source[] {
    if (!this._sources) {
      this._sources = this.room.find(FIND_SOURCES);
    }
    return this._sources;
  }

  get towers(): StructureTower[] {
    if (!this._towers) {
      this._towers = this.room.find<StructureTower>(FIND_MY_STRUCTURES,
        { filter: (s) => s.structureType == STRUCTURE_TOWER });
    }
    return this._towers;
  }

  get roads(): StructureRoad[] {
    if (!this._roads) {
      this._roads = this.room.find<StructureRoad>(FIND_STRUCTURES,
        { filter: (s) => s.structureType == STRUCTURE_ROAD });
    }
    return this._roads;
  }

  get ramparts(): StructureRampart[] {
    if (!this._ramparts) {
      this._ramparts = this.room.find<StructureRampart>(FIND_MY_STRUCTURES,
        { filter: (s) => s.structureType == STRUCTURE_TOWER });
    }
    return this._ramparts;
  }

  get constructionSites(): ConstructionSite[] {
    if (!this._constructionSites) {
      this._constructionSites = this.room.find(FIND_MY_CONSTRUCTION_SITES);
    }
    return this._constructionSites;
  }

  get ownedFlags(): Flag[] {
    if (!this._ownedFlags) {
      this._ownedFlags = _.filter(Game.flags, (f) => f.name.startsWith(this.room.name));
    }
    return this._ownedFlags;
  }

  get creeps(): Creep[] {
    if (!this._creeps) {
      this._creeps = _.filter(Game.creeps, (c) => {
        if (c.spawning) {
          return false;
        }
        if (c.memory.home) {
          return c.memory.home == this.room.name;
        }
        return (c.room.name === this.room.name);
      });
    }
    return this._creeps;
  }
}

export default function Room$(room: Room): RoomCache {
  return room._cache;
}
