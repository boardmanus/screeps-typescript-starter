// memory extension samples
interface CreepMemory {
  _move: { path: string };
  lastPosition: RoomPosition | undefined;
  stuckCount: number | undefined;
  stalledCount: number | undefined;
  home: string | undefined;
}

interface SourceMemory {
  id: string;
  container: string | undefined;
  link: string | undefined;
}

interface StorageMemory {
  id: string;
  link: string | undefined;
}

interface SpawnMemory {
  id: string;
  link: string | undefined;
}

interface BossMemory {
  job: string;
  workers: string[];
}

interface WorkerMemory {
  job: string;
  worker: string;
}

interface ExecutiveMemory {
  business: string;
  employees: WorkerMemory[];
  resumes: string[];
}

interface ArchitectMemory {
  roading: { [type: string]: number };
}

interface RoomMemory {
  remoteMines: SourceMemory[];
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


type UnloadSite = StructureTerminal | StructureExtension | StructureSpawn | StructureStorage | StructureContainer | StructureLink | StructureTower;
type PickupSite = Resource | Tombstone | StructureStorage | StructureContainer | StructureStorage | StructureLink | StructureExtension | StructureSpawn;
type PickupStoreSite = Tombstone | StructureStorage | StructureContainer | StructureStorage | StructureLink | StructureExtension | StructureSpawn;

declare const RESOURCE_ALL: RESOURCE_ALL;
declare const RESOURCE_MINERALS: RESOURCE_MINERALS;
type RESOURCE_ALL = 'all';
type RESOURCE_MINERALS = 'minerals';
type ResourceType = ResourceConstant | RESOURCE_ENERGY | RESOURCE_ALL | RESOURCE_MINERALS;
