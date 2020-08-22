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
    return this._sources ?? this.room.find(FIND_SOURCES);
  }

  get towers(): StructureTower[] {
    return this._towers ?? this.room.find<StructureTower>(FIND_MY_STRUCTURES,
      { filter: (s) => s.structureType == STRUCTURE_TOWER });
  }

  get roads(): StructureRoad[] {
    return this._roads ?? this.room.find<StructureRoad>(FIND_STRUCTURES,
      { filter: (s) => s.structureType == STRUCTURE_ROAD });
  }

  get ramparts(): StructureRampart[] {
    return this._ramparts ?? this.room.find<StructureRampart>(FIND_MY_STRUCTURES,
      { filter: (s) => s.structureType == STRUCTURE_TOWER });
  }

  get constructionSites(): ConstructionSite[] {
    return this._constructionSites ?? this.room.find(FIND_MY_CONSTRUCTION_SITES);
  }

  get ownedFlags(): Flag[] {
    return this._ownedFlags ?? _.filter(Game.flags, (f) => f.name.startsWith(this.room.name));
  }

  get creeps(): Creep[] {
    return this._creeps ?? _.filter(Game.creeps, (c) => {
      if (c.spawning) {
        return false;
      }
      if (c.memory.home) {
        return c.memory.home == this.room.name;
      }
      return (c.room.name === this.room.name);
    });
  }
}

export default function Room$(room: Room): RoomCache {
  return room._cache;
}
