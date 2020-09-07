interface Memory {
  profiler: ProfilerMemory;
}

interface ProfilerMemory {
  data: { [name: string]: ProfilerData };
  start?: number;
  total: number;
}

interface ProfilerData {
  calls: number;
  time: number;
  nestedTime: number;
  totalTime: number;
}

interface Profiler {
  clear(): void;
  output(): void;
  start(): void;
  status(): void;
  stop(): void;
}

declare const __PROFILER_ENABLED__: boolean;
