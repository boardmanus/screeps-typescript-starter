// memory extension samples
interface CreepMemory {
  _move: { path: string };
  lastPosition: RoomPosition | undefined;
  stuckCount: number | undefined;
}

interface SourceMemory {
  id: string | undefined;
  container: string | undefined;
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


type UnloadSite = StructureTerminal | StructureExtension | StructureSpawn | StructureStorage | StructureContainer | StructureLink | StructureTower;
type PickupSite = Resource | Tombstone | StructureStorage | StructureContainer | StructureStorage | StructureLink | StructureExtension | StructureSpawn;

