import Cli from 'Cli';

export const __PROFILER_ENABLED__ = true;

interface NestedTime {
  nestedTime: number;
}
const profilerStack: NestedTime[] = [];

/* tslint:disable:ban-types */
export function init(): Profiler {
  const defaults = {
    data: {},
    total: 0
  };

  console.log('Profiler init!!!!');
  if (!Memory.profiler) { Memory.profiler = defaults; }

  const cli: Profiler = {
    clear() {
      const running = isEnabled();
      Memory.profiler = defaults;
      if (running) { Memory.profiler.start = Game.time; }
      return 'Profiler Memory cleared';
    },

    output() {
      outputProfilerData();
      return 'Done';
    },

    start() {
      Memory.profiler.data = {};
      Memory.profiler.start = Game.time;
      return 'Profiler started';
    },

    status(): string {
      if (isEnabled()) {
        return 'Profiler is running';
      }
      return 'Profiler is stopped';
    },

    stop() {
      if (!isEnabled()) { return ''; }
      const timeRunning = Game.time - Memory.profiler.start!;
      Memory.profiler.total += timeRunning;
      delete Memory.profiler.start;
      return 'Profiler stopped';
    }

  };

  return cli;
}

function wrapFunction(obj: object, key: PropertyKey, klassName?: string) {
  const descriptor = Reflect.getOwnPropertyDescriptor(obj, key);
  if (!descriptor || descriptor.get || descriptor.set) { return; }

  if (key === 'constructor') { return; }

  const originalFunction = descriptor.value;
  if (!originalFunction || typeof originalFunction !== 'function') { return; }

  // set a key for the object in memory
  const className = klassName ?? (obj.constructor ? `${obj.constructor.name}` : '');
  const memKey = `${className}:${String(key)}`;

  // set a tag so we don't wrap a function twice
  const savedName = `__${String(key)}__`;
  if (Reflect.has(obj, savedName)) { return; }

  Reflect.set(obj, savedName, originalFunction);

  /// ////////
  Reflect.set(obj, key, function wrap(this: any, ...args: any[]) {
    if (isEnabled()) {
      let data = Memory.profiler.data[memKey];
      if (!data) {
        data = {
          calls: 0,
          time: 0,
          nestedTime: 0,
          totalTime: 0
        };
        Memory.profiler.data[memKey] = data;
      }
      profilerStack.push({ nestedTime: 0 });

      const start = Game.cpu.getUsed();
      const result = originalFunction.apply(this, args);
      const end = Game.cpu.getUsed();
      const dt = end - start;

      const nestedTime = profilerStack.pop()!;
      const parentNestedTime = _.last(profilerStack);

      record(data, nestedTime, parentNestedTime, dt);
      return result;
    }
    return originalFunction.apply(this, args);
  });
}

export function profile(target: Function): void;
export function profile(target: object, key: string | symbol, _descriptor: TypedPropertyDescriptor<Function>): void;
export function profile(
  target: object | Function,
  key?: string | symbol,
  _descriptor?: TypedPropertyDescriptor<Function>
): void {
  if (!__PROFILER_ENABLED__) { return; }

  if (key) {
    // case of method decorator
    wrapFunction(target, key);
    return;
  }

  // case of class decorator

  const ctor = target as any;
  if (!ctor.prototype) { return; }

  const className = ctor.name;
  Reflect.ownKeys(ctor.prototype).forEach((k) => {
    wrapFunction(ctor.prototype, k, className);
  });

}

function isEnabled(): boolean {
  return Memory.profiler.start !== undefined;
}

function record(data: ProfilerData, nestedTime: NestedTime, parentNestedTime: NestedTime, time: number) {
  data.calls++;
  data.totalTime += time;
  data.time += time - nestedTime.nestedTime;
  data.nestedTime += nestedTime.nestedTime;

  if (parentNestedTime) {
    parentNestedTime.nestedTime += time;
  }
}

interface OutputData {
  name: string;
  calls: number;
  cpuPerCall: number;
  callsPerTick: number;
  cpuPerTick: number;
  time: number;
  nestedTime: number;
  totalTime: number;
}

function outputProfilerData() {
  let totalTicks = Memory.profiler.total;
  if (Memory.profiler.start) {
    totalTicks += Game.time - Memory.profiler.start;
  }

  /// ////
  // Process data
  let totalCpu = 0; // running count of average total CPU use per tick
  const data = Reflect.ownKeys(Memory.profiler.data).map((key) => {
    const keyData = Memory.profiler.data[String(key)];
    const { calls, time, nestedTime, totalTime } = keyData;
    const result: OutputData = {
      name: `${String(key)}`,
      calls,
      cpuPerCall: time / calls,
      callsPerTick: calls / totalTicks,
      cpuPerTick: time / totalTicks,
      time,
      nestedTime: nestedTime ?? -1,
      totalTime: totalTime ?? -1
    };
    totalCpu += result.cpuPerTick;
    return result;
  });

  data.sort((lhs, rhs) => rhs.cpuPerTick - lhs.cpuPerTick);

  const rows: string[][] = [];

  // Data Header
  rows.push([
    'Function', 'Tot Calls', 'Calls/Tick', 'CPU/Call', 'CPU/Tick',
    'CPU Time', 'Nested CPU', 'Total CPU',
    '% of Tot', '% of Bket'
  ]);

  const alignLeft: boolean[] = [
    true, false, false, false, false,
    false, false, false,
    false, false
  ];

  // Data rows
  _.each(_.filter(data,
    (d) => (d.cpuPerTick / totalCpu) * 100 > 0.5),
    (d) => rows.push([
      `${d.name}`, `${d.calls}`,
      `${Math.round(d.callsPerTick)}`,
      `${d.cpuPerCall.toFixed(2)} cpu`,
      `${d.cpuPerTick.toFixed(2)} cpu`,
      `${d.time.toFixed(2)} cpu`,
      `${d.nestedTime.toFixed(2)} cpu`,
      `${d.totalTime.toFixed(2)} cpu`,
      `${((d.cpuPerTick / totalCpu) * 100).toPrecision(3)} %`,
      `${((d.cpuPerTick / Game.cpu.limit) * 100).toPrecision(3)} %`
    ]));

  // Data Total
  rows.push([
    'Totals', `${_.sum(data, (d) => d.calls)}`,
    `${Math.round(_.sum(data, (d) => d.callsPerTick))}`,
    `${_.sum(data, (d) => d.cpuPerCall).toFixed(2)} cpu`,
    `${_.sum(data, (d) => d.cpuPerTick).toFixed(2)} cpu`,
    `${_.sum(data, (d) => d.time).toFixed(2)} cpu`,
    `${_.sum(data, (d) => d.nestedTime).toFixed(2)} cpu`,
    `${_.sum(data, (d) => d.totalTime).toFixed(2)} cpu`,
    `${_.sum(data, (d) => ((d.cpuPerTick / totalCpu) * 100)).toPrecision(3)} %`,
    `${_.sum(data, (d) => ((d.cpuPerTick / Game.cpu.limit) * 100)).toPrecision(3)} %`
  ]);

  const fmt = Cli.getFormatting(rows, alignLeft);
  _.each(rows, (row) => console.log(Cli.formatRow(row, '   ', fmt)));

  console.log(`${totalTicks} total ticks measured\t\t\t${totalCpu.toPrecision(2)} average CPU profiled per tick`);
}
