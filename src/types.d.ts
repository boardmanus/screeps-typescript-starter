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


type UnloadSite = StructureExtension | StructureSpawn | StructureStorage | StructureContainer | StructureLink | StructureTower;
type PickupSite = Resource | StructureContainer | StructureStorage | StructureLink | StructureExtension | StructureSpawn;

