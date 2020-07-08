interface RoomPosition {
  surroundingPositions(radius: number, filter?: (p: RoomPosition) => boolean): RoomPosition[];
}

interface RoomObject {
  available(resource?: ResourceConstant): number;
  freeSpace(resource?: ResourceConstant): number;
  capacity(): number;
}

interface Creep {
  _job: string | undefined;
  _lastJobSite: RoomObject;
  setJob(job: string | undefined): void;
  isEmployed(): boolean;
  setLastJobSite(lastJobSite: RoomObject): void;
  getLastJobSite(): RoomObject | undefined;
  jobMoveTo(pos: RoomPosition | RoomObject, range: number, style: LineStyle): number;
}

interface Source {
  _container: StructureContainer | undefined;
  _tower: StructureTower | undefined;
  _link: StructureLink | undefined;
}

interface Mineral {
  _container: StructureContainer | undefined;
  _link: StructureLink | undefined;
}

interface StructureStorage {
  _link: StructureLink | undefined;
}

interface StructureSpawn {
  _link: StructureLink | undefined;
}

interface StructureLink {
  _isSink: boolean | undefined;
}


// add objects to `global` here
declare namespace NodeJS {
  interface Global {
    log: any;
  }
}

declare const __REVISION__: string
