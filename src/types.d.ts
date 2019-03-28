// example declaration file - remove these and add your own custom typings

// memory extension samples
interface CreepMemory {
  role: string;
  room: string;
  working: boolean;
}

interface Memory {
  uuid: number;
  log: any;
}

declare module "*.json" {
  const value: any;
  export default value;
}

// `global` extension samples
declare namespace NodeJS {
  interface Global {
    log: any;
  }
}
