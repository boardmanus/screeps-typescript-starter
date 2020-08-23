
interface Room {
  _cache: any | undefined;
}

interface RoomPosition {
  surroundingPositions(radius: number, filter?: (p: RoomPosition) => boolean): RoomPosition[];
}

interface RoomObject {
  available(resource?: ResourceType): number;
  freeSpace(resource?: ResourceType): number;
  capacity(): number;
}

interface Creep {
  _job: any;
  _lastJob: any;
  _business: any;
  isEmployed(): boolean;
  setJob(job?: any): void;
  getJob(): any;
  setLastJob(lastJob?: any): void;
  getLastJob(): any;
  setBusiness(business?: any): void;
  getBusiness(): any;
}

interface Source {
  _container: StructureContainer | ConstructionSite | undefined;
  _link: StructureLink | ConstructionSite | undefined;

  link(): StructureLink | undefined;
  container(): StructureContainer | undefined;
}

interface Mineral {
  _container: StructureContainer | ConstructionSite | undefined;
  _extractor: StructureExtractor | ConstructionSite | undefined;

  container(): StructureContainer | undefined;
  extractor(): StructureExtractor | undefined;
}

interface Deposit {
  _container: StructureContainer | ConstructionSite | undefined;
  container(): StructureContainer | undefined;
}

interface StructureStorage {
  _link: StructureLink | ConstructionSite | undefined;
  link(): StructureLink | undefined;
}

interface StructureController {
  _container: StructureContainer | ConstructionSite | undefined;
  container(): StructureContainer | undefined;
}

interface StructureSpawn {
  _recycler: StructureContainer | ConstructionSite | undefined;
  recycler(): StructureContainer | undefined;
}

interface StructureLink {
  _isSink: boolean | undefined;
}


// add objects to `global` here
declare namespace NodeJS {
  interface Global {
    log: any;
    Profiler: any;
  }
}

declare const __REVISION__: string
