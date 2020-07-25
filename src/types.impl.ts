import { log } from 'ScrupsLogger'
import u from 'Utility';

RoomPosition.prototype.surroundingPositions = function (radius: number, filter?: (p: RoomPosition) => boolean): RoomPosition[] {
  const minx = Math.max(0, this.x - radius);
  const maxx = Math.min(this.x + radius, 50);
  const miny = Math.max(0, this.y - radius);
  const maxy = Math.min(this.y + radius, 50);
  const positions = [];
  for (let x = minx; x <= maxx; ++x) {
    for (let y = miny; y <= maxy; ++y) {
      const pos = new RoomPosition(x, y, this.roomName);
      if (!filter || filter(pos)) {
        positions.push(pos);
      }
    }
  }

  return positions;
}

RoomObject.prototype.available = function (_?: ResourceConstant): number {
  return 0;
}
RoomObject.prototype.freeSpace = function (_?: ResourceConstant): number {
  return 0;
}
RoomObject.prototype.holding = function (): number {
  return this.capacity() - this.freeSpace();
}
RoomObject.prototype.capacity = function (): number {
  return 0;
}

Resource.prototype.available = function (resource = RESOURCE_ENERGY): number {
  return (this.resourceType == resource) ? this.amount : 0;
}

Tombstone.prototype.available = function (resource = RESOURCE_ENERGY): number {
  return this.store[resource] ?? 0;
}

Source.prototype.available = function (resource = RESOURCE_ENERGY): number {
  return (resource == RESOURCE_ENERGY) ? this.energy : 0;
}

Source.prototype.link = function (): StructureLink | undefined {
  return (this._link instanceof StructureLink) ? this._link : undefined;
}

Source.prototype.container = function (): StructureContainer | undefined {
  return (this._container instanceof StructureContainer) ? this._container : undefined;
}

Mineral.prototype.available = function (resource?: ResourceConstant): number {
  return (resource == this.mineralType) ? this.mineralAmount : 0;
}

StructureController.prototype.container = function (): StructureContainer | undefined {
  return (this._container instanceof StructureContainer) ? this._container : undefined;
}

StructureExtension.prototype.available = function (resource = RESOURCE_ENERGY): number {
  return this.store[resource] ?? 0;
}
StructureExtension.prototype.freeSpace = function (resource = RESOURCE_ENERGY): number {
  return this.store.getFreeCapacity(resource) ?? 0;
}
StructureExtension.prototype.capacity = function (): number {
  return this.store.getCapacity(RESOURCE_ENERGY) ?? 0;
}

StructureLink.prototype.available = function (resource = RESOURCE_ENERGY): number {
  return this.store[resource] ?? 0;
}
StructureLink.prototype.freeSpace = function (resource = RESOURCE_ENERGY): number {
  return this.store.getFreeCapacity(resource) ?? 0;
}
StructureLink.prototype.capacity = function (): number {
  return this.store.getCapacity(RESOURCE_ENERGY) ?? 0;
}

StructureSpawn.prototype.available = function (resource = RESOURCE_ENERGY): number {
  return this.store[resource] ?? 0;
}
StructureSpawn.prototype.freeSpace = function (resource = RESOURCE_ENERGY): number {
  return this.store.getFreeCapacity(resource) ?? 0;
}
StructureSpawn.prototype.capacity = function (): number {
  return this.store.getCapacity(RESOURCE_ENERGY) ?? 0;
}
StructureSpawn.prototype.recycler = function (): StructureContainer | undefined {
  return (this._recycler instanceof StructureContainer) ? this._recycler : undefined;
}

StructureContainer.prototype.available = function (resource = RESOURCE_ENERGY): number {
  return this.store[resource] ?? 0;
}
StructureContainer.prototype.freeSpace = function (__?: ResourceConstant): number {
  return this.store.getFreeCapacity();
}
StructureContainer.prototype.capacity = function (): number {
  return this.store.getCapacity();
}

StructureStorage.prototype.available = function (resource = RESOURCE_ENERGY): number {
  return this.store[resource] ?? 0;
}
StructureStorage.prototype.freeSpace = function (__?: ResourceConstant): number {
  return this.store.getFreeCapacity();
}
StructureStorage.prototype.capacity = function (): number {
  return this.store.getCapacity();
}
StructureStorage.prototype.link = function (): StructureLink | undefined {
  return (this._link instanceof StructureLink) ? this._link : undefined;
}

StructureTower.prototype.available = function (resource = RESOURCE_ENERGY): number {
  return this.store[resource] ?? 0;
}
StructureTower.prototype.freeSpace = function (resource = RESOURCE_ENERGY): number {
  return this.store.getFreeCapacity(resource) ?? 0;
}
StructureTower.prototype.capacity = function (): number {
  return this.store.getCapacity(RESOURCE_ENERGY) ?? 0;
}

Creep.prototype.available = function (resource = RESOURCE_ENERGY): number {
  return this.store[resource] ?? 0;
}
Creep.prototype.freeSpace = function (__?: ResourceConstant): number {
  return this.store.getFreeCapacity();
}
Creep.prototype.capacity = function (): number {
  return this.store.getCapacity();
}
Creep.prototype.setJob = function (job: string | undefined): void {
  this._job = job;
}
Creep.prototype.isEmployed = function (): boolean {
  return (this._job ? true : false);
}
Creep.prototype.setLastJob = function (lastJob: Object): void {
  this._lastJob = lastJob;
}
Creep.prototype.getLastJob = function (): Object | undefined {
  return this._lastJob;
}
Creep.prototype.jobMoveTo = function (pos: RoomPosition | RoomObject, range: number, style: LineStyle): number {

  if (this.fatigue) {
    log.warning(`${this}: failed moving to ${pos} (tired)`);
    return ERR_TIRED;
  }

  if (this.spawning) {
    log.warning(`${this}: failed moving to ${pos} (still spawning)`);
    return ERR_BUSY;
  }

  const lastPos = this.memory.lastPosition ?? this.pos;
  const stuck = this.pos.inRangeTo(lastPos, 0);
  const stuckCount = stuck ? (this.memory.stuckCount ?? 0) + 1 : 0;

  this.memory.lastPosition = this.pos;
  this.memory.stuckCount = stuckCount;

  if (stuckCount < 2) {
    const pathLength = this.memory._move?.path.length ?? 10;
    const ignoreCreeps = (pathLength > 5);
    const reusePath = (stuckCount && !ignoreCreeps) ? 5 : 50;
    style.lineStyle = ignoreCreeps ? "solid" : "dashed";
    const res = this.moveTo(pos, { ignoreCreeps: ignoreCreeps, range: range, reusePath: reusePath, visualizePathStyle: style });
    return res;
  }

  // Re-evaluate the path, ensuring creeps aren't ignored this time.
  log.warning(`${this}: stuck-${stuckCount} at ${pos}`);
  const reusePath = (stuckCount > 5) ? 0 : 5 - stuckCount;
  const res = this.moveTo(pos, { ignoreCreeps: false, range: range, reusePath: reusePath, visualizePathStyle: style });

  return res;
}
