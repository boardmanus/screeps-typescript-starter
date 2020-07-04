// memory extension samples
interface CreepMemory {
  _move: {};
  //job: string | undefined;
  //employed: boolean | undefined;
  //homeTown: string;
  lastPosition: RoomPosition | undefined;
}

interface SourceMemory {
  id: string | undefined;
  container: string | undefined;
  tower: string | undefined;
  link: string | undefined;
}

interface StorageMemory {
  id: string | undefined;
  link: string | undefined;
}

interface SpawnMemory {
  id: string | undefined;
  link: string | undefined;
}

interface BossMemory {
  job: string;
  workers: string[];
}

interface ExecutiveMemory {
  business: string;
  employees: BossMemory[];
  contractors: BossMemory[];
}

interface ArchitectMemory {
  roading: { [type: string]: number };
}

interface RoomMemory {
  expats: string[];
  executives: ExecutiveMemory[];
  bosses: BossMemory[];
  sources: SourceMemory[];
  storage: StorageMemory;
  spawns: SpawnMemory[];
  architect: ArchitectMemory;
  cloneCount: number;
}

interface SubcontractorMemory {
  worker: string;
  job: string;
}

interface AssignmentMemory {
  worker: string;
  job: string;
  prerequisite: AssignmentMemory | undefined;
}

interface Memory {
  uuid: number;
  log: any;
}


declare const __REVISION__: string



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
  _container: StructureContainer | null;
  _tower: StructureTower | null;
  _link: StructureLink | null;
}

interface Mineral {
  _container: StructureContainer | null;
  _link: StructureLink | undefined;
}

interface StructureStorage {
  _link: StructureLink | null;
}

interface StructureSpawn {
  _link: StructureLink | null;
}

type UnloadSite = StructureExtension | StructureSpawn | StructureStorage | StructureContainer | StructureLink | StructureTower;
type PickupSite = Resource | StructureContainer | StructureStorage | StructureLink | StructureExtension | StructureSpawn;



// add objects to `global` here
declare namespace NodeJS {
  interface Global {
    log: any;
  }
}
