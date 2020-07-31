import { log } from 'ScrupsLogger'
import u from 'Utility';
import * as Job from 'Job';

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

RoomObject.prototype.available = function (_?: ResourceType): number {
  return 0;
}
RoomObject.prototype.freeSpace = function (_?: ResourceType): number {
  return 0;
}
RoomObject.prototype.capacity = function (): number {
  return 0;
}

Resource.prototype.available = function (resource: ResourceType = u.RESOURCE_ALL): number {
  return u.resource_matches_type(RESOURCE_ENERGY, resource) ? this.amount : 0;
}
Resource.prototype.capacity = function (): number {
  return this.amount;
}

Tombstone.prototype.available = function (resource: ResourceType = u.RESOURCE_ALL): number {
  return u.store_resource_amount(this.store, resource);
}
Tombstone.prototype.capacity = function (): number {
  return this.store.getUsedCapacity();
}

Source.prototype.available = function (resource: ResourceType = u.RESOURCE_ALL): number {
  return u.resource_matches_type(RESOURCE_ENERGY, resource) ? this.energy : 0;
}
Source.prototype.capacity = function (): number {
  return this.energyCapacity;
}
Source.prototype.link = function (): StructureLink | undefined {
  return (this._link instanceof StructureLink) ? this._link : undefined;
}
Source.prototype.container = function (): StructureContainer | undefined {
  return (this._container instanceof StructureContainer) ? this._container : undefined;
}

Mineral.prototype.available = function (resource: ResourceType = u.RESOURCE_ALL): number {
  return u.resource_matches_type(RESOURCE_ENERGY, resource) ? this.mineralAmount : 0;
}
Mineral.prototype.capacity = function (): number {
  return this.density;
}
Mineral.prototype.container = function (): StructureContainer | undefined {
  return (this._container instanceof StructureContainer) ? this._container : undefined;
}
Mineral.prototype.extractor = function (): StructureExtractor | undefined {
  return (this._extractor instanceof StructureExtractor) ? this._extractor : undefined;
}

StructureController.prototype.container = function (): StructureContainer | undefined {
  return (this._container instanceof StructureContainer) ? this._container : undefined;
}

StructureExtension.prototype.available = function (resource: ResourceType = u.RESOURCE_ALL): number {
  return u.limited_store_resource_amount(this.store, resource, RESOURCE_ENERGY);
}
StructureExtension.prototype.capacity = function (): number {
  return this.store.getCapacity(RESOURCE_ENERGY);
}
StructureExtension.prototype.freeSpace = function (resource: ResourceType = u.RESOURCE_ALL): number {
  return u.resource_matches_type(RESOURCE_ENERGY, resource) ? this.store.getFreeCapacity(RESOURCE_ENERGY) : 0;
}
StructureExtension.prototype.capacity = function (): number {
  return this.store.getCapacity(RESOURCE_ENERGY) ?? 0;
}

StructureLink.prototype.available = function (resource: ResourceType = u.RESOURCE_ALL): number {
  return u.limited_store_resource_amount(this.store, resource, RESOURCE_ENERGY);
}
StructureLink.prototype.capacity = function (): number {
  return this.store.getCapacity(RESOURCE_ENERGY);
}
StructureLink.prototype.freeSpace = function (resource: ResourceType = u.RESOURCE_ALL): number {
  return u.resource_matches_type(RESOURCE_ENERGY, resource) ? this.store.getFreeCapacity(RESOURCE_ENERGY) : 0;
}
StructureLink.prototype.capacity = function (): number {
  return this.store.getCapacity(RESOURCE_ENERGY) ?? 0;
}

StructureSpawn.prototype.available = function (resource: ResourceType = u.RESOURCE_ALL): number {
  return u.limited_store_resource_amount(this.store, resource, RESOURCE_ENERGY);
}
StructureSpawn.prototype.capacity = function (): number {
  return this.store.getCapacity(RESOURCE_ENERGY);
}
StructureSpawn.prototype.freeSpace = function (resource: ResourceType = u.RESOURCE_ALL): number {
  return u.resource_matches_type(RESOURCE_ENERGY, resource) ? this.store.getFreeCapacity(RESOURCE_ENERGY) : 0;
}
StructureSpawn.prototype.capacity = function (): number {
  return this.store.getCapacity(RESOURCE_ENERGY) ?? 0;
}
StructureSpawn.prototype.recycler = function (): StructureContainer | undefined {
  return (this._recycler instanceof StructureContainer) ? this._recycler : undefined;
}

StructureContainer.prototype.available = function (resource: ResourceType = u.RESOURCE_ALL): number {
  return u.store_resource_amount(this.store, resource);
}
StructureContainer.prototype.freeSpace = function (__?: ResourceType): number {
  return this.store.getFreeCapacity();
}
StructureContainer.prototype.capacity = function (): number {
  return this.store.getCapacity();
}

StructureStorage.prototype.available = function (resource: ResourceType = u.RESOURCE_ALL): number {
  return u.store_resource_amount(this.store, resource);
}
StructureStorage.prototype.freeSpace = function (__?: ResourceType): number {
  return this.store.getFreeCapacity();
}
StructureStorage.prototype.capacity = function (): number {
  return this.store.getCapacity();
}
StructureStorage.prototype.link = function (): StructureLink | undefined {
  return (this._link instanceof StructureLink) ? this._link : undefined;
}

StructureTerminal.prototype.available = function (resource: ResourceType = u.RESOURCE_ALL): number {
  return u.store_resource_amount(this.store, resource);
}
StructureTerminal.prototype.freeSpace = function (__?: ResourceType): number {
  return this.store.getFreeCapacity();
}
StructureTerminal.prototype.capacity = function (): number {
  return this.store.getCapacity();
}

StructureTower.prototype.available = function (resource: ResourceType = u.RESOURCE_ALL): number {
  return u.limited_store_resource_amount(this.store, resource, RESOURCE_ENERGY);
}
StructureTower.prototype.freeSpace = function (resource: ResourceType = u.RESOURCE_ALL): number {
  return u.resource_matches_type(RESOURCE_ENERGY, resource) ? this.store.getFreeCapacity(RESOURCE_ENERGY) : 0;
}
StructureTower.prototype.capacity = function (): number {
  return this.store.getCapacity(RESOURCE_ENERGY);
}

Creep.prototype.available = function (resource: ResourceType = u.RESOURCE_ALL): number {
  return u.store_resource_amount(this.store, resource);
}
Creep.prototype.freeSpace = function (__?: ResourceType): number {
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
Creep.prototype.setLastJob = function (lastJob: Job.Model): void {
  this._lastJob = lastJob;
  this.memory.lastJob = lastJob.id();
}
Creep.prototype.getLastJob = function (): Object | undefined {
  return this._lastJob;
}
