// memory extension samples
interface CreepMemory {
  _move: { path: string };
  lastPosition: RoomPosition | undefined;
  stuckCount: number | undefined;
  stalledCount: number | undefined;
  home: string | undefined;
  business: string | undefined;
  job: string | undefined;
  lastJob: string | undefined;
  superfluous: boolean | undefined;
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
/*
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
*/
interface ArchitectMemory {
  roading: { [type: string]: number };
}

interface RoomMemory {
  remoteMines: SourceMemory[];
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


type UnloadSite = Creep | StructureTerminal | StructureExtension | StructureSpawn | StructureStorage | StructureContainer | StructureLink | StructureTower;
type PickupSite = Creep | Resource | Tombstone | Ruin | StructureStorage | StructureContainer | StructureStorage | StructureLink | StructureExtension | StructureSpawn;
type PickupStoreSite = Tombstone | Ruin | StructureStorage | StructureContainer | StructureStorage | StructureLink | StructureExtension | StructureSpawn;

////declare const RESOURCE_ALL: ResourceType;
//declare const RESOURCE_MINERALS: ResourceType;
//type RESOURCE_ALL = 'all';
//type RESOURCE_MINERALS = 'minerals';

type ResourceType = ResourceConstant | 'all' | 'minerals';
