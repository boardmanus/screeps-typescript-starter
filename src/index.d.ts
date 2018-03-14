// memory extension samples
interface CreepMemory {
  _move: {};
  job: string | undefined;
  employed: boolean | undefined;
  homeTown: string;
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
  subcontractors: SubcontractorMemory[];
}

interface ArchitectMemory {
  roading: { [type : string] : number };
}

interface RoomMemory {
  expats: string[];
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

// add objects to `global` here
declare namespace NodeJS {
  interface Global {
    log: any;
  }
}

interface Memory {
  uuid: number;
  log: any;
}


declare const __REVISION__: string


