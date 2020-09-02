import * as u from 'Utility';
import * as Business from 'Business';
import * as Job from 'Job';

RoomPosition.prototype.surroundingPositions = function surroundingPositions(radius: number, filter?: (p: RoomPosition) => boolean): RoomPosition[] {
  const minx = Math.max(1, this.x - radius);
  const maxx = Math.min(this.x + radius, 48);
  const miny = Math.max(1, this.y - radius);
  const maxy = Math.min(this.y + radius, 48);
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
};

RoomObject.prototype.available = function available(_?: ResourceType): number {
  return 0;
};
RoomObject.prototype.freeSpace = function freeSpace(_?: ResourceType): number {
  return 0;
};
RoomObject.prototype.capacity = function capacity(): number {
  return 0;
};

Resource.prototype.available = function available(resource: ResourceType = u.RESOURCE_ALL): number {
  return u.resource_matches_type(RESOURCE_ENERGY, resource) ? this.amount : 0;
};
Resource.prototype.capacity = function capacity(): number {
  return this.amount;
};

Tombstone.prototype.available = function available(resource: ResourceType = u.RESOURCE_ALL): number {
  return u.store_resource_amount(this.store, resource);
};
Tombstone.prototype.capacity = function capacity(): number {
  return this.store.getUsedCapacity();
};

Ruin.prototype.available = function available(resource: ResourceType = u.RESOURCE_ALL): number {
  return u.store_resource_amount(this.store, resource);
};
Ruin.prototype.capacity = function capacity(): number {
  return this.store.getUsedCapacity();
};

Source.prototype.available = function available(resource: ResourceType = u.RESOURCE_ALL): number {
  return u.resource_matches_type(RESOURCE_ENERGY, resource) ? this.energy : 0;
};
Source.prototype.capacity = function capacity(): number {
  return this.energyCapacity;
};
Source.prototype.link = function link(): StructureLink | undefined {
  return (this._link instanceof StructureLink) ? this._link : undefined;
};
Source.prototype.container = function container(): StructureContainer | undefined {
  return (this._container instanceof StructureContainer) ? this._container : undefined;
};

Deposit.prototype.available = function available(resource: ResourceType = u.RESOURCE_ALL): number {
  if (!u.resource_matches_type(this.depositType, resource)) {
    return 0;
  }

  const amount = (this.ticksToDecay > 1000) ? 1000 : this.ticksToDecay;
  return amount;
};
Deposit.prototype.capacity = function capacity(): number {
  return 1000;
};
Deposit.prototype.container = function container(): StructureContainer | undefined {
  return (this._container instanceof StructureContainer) ? this._container : undefined;
};

Mineral.prototype.available = function available(resource: ResourceType = u.RESOURCE_ALL): number {
  return u.resource_matches_type(this.mineralType, resource) ? this.mineralAmount : 0;
};
Mineral.prototype.capacity = function capacity(): number {
  return this.density;
};
Mineral.prototype.container = function container(): StructureContainer | undefined {
  return (this._container instanceof StructureContainer) ? this._container : undefined;
};
Mineral.prototype.extractor = function extractor(): StructureExtractor | undefined {
  return (this._extractor instanceof StructureExtractor) ? this._extractor : undefined;
};

StructureController.prototype.container = function container(): StructureContainer | undefined {
  return (this._container instanceof StructureContainer) ? this._container : undefined;
};

StructureExtension.prototype.available = function available(resource: ResourceType = u.RESOURCE_ALL): number {
  return u.limited_store_resource_amount(this.store, resource, RESOURCE_ENERGY);
};
StructureExtension.prototype.capacity = function capacity(): number {
  return this.store.getCapacity(RESOURCE_ENERGY);
};
StructureExtension.prototype.freeSpace = function freeSpace(resource: ResourceType = u.RESOURCE_ALL): number {
  return u.resource_matches_type(RESOURCE_ENERGY, resource) ? this.store.getFreeCapacity(RESOURCE_ENERGY) : 0;
};
StructureExtension.prototype.capacity = function capacity(): number {
  return this.store.getCapacity(RESOURCE_ENERGY) ?? 0;
};

StructureLink.prototype.available = function available(resource: ResourceType = u.RESOURCE_ALL): number {
  return u.limited_store_resource_amount(this.store, resource, RESOURCE_ENERGY);
};
StructureLink.prototype.capacity = function capacity(): number {
  return this.store.getCapacity(RESOURCE_ENERGY);
};
StructureLink.prototype.freeSpace = function freeSpace(resource: ResourceType = u.RESOURCE_ALL): number {
  return u.resource_matches_type(RESOURCE_ENERGY, resource) ? this.store.getFreeCapacity(RESOURCE_ENERGY) : 0;
};
StructureLink.prototype.capacity = function capacity(): number {
  return this.store.getCapacity(RESOURCE_ENERGY) ?? 0;
};

StructureSpawn.prototype.available = function available(resource: ResourceType = u.RESOURCE_ALL): number {
  return u.limited_store_resource_amount(this.store, resource, RESOURCE_ENERGY);
};
StructureSpawn.prototype.capacity = function capacity(): number {
  return this.store.getCapacity(RESOURCE_ENERGY);
};
StructureSpawn.prototype.freeSpace = function freeSpace(resource: ResourceType = u.RESOURCE_ALL): number {
  return u.resource_matches_type(RESOURCE_ENERGY, resource) ? this.store.getFreeCapacity(RESOURCE_ENERGY) : 0;
};
StructureSpawn.prototype.capacity = function capacity(): number {
  return this.store.getCapacity(RESOURCE_ENERGY) ?? 0;
};
StructureSpawn.prototype.recycler = function recycler(): StructureContainer | undefined {
  return (this._recycler instanceof StructureContainer) ? this._recycler : undefined;
};

StructureContainer.prototype.available = function available(resource: ResourceType = u.RESOURCE_ALL): number {
  return u.store_resource_amount(this.store, resource);
};
StructureContainer.prototype.freeSpace = function freeSpace(__?: ResourceType): number {
  return this.store.getFreeCapacity();
};
StructureContainer.prototype.capacity = function capacity(): number {
  return this.store.getCapacity();
};

StructureStorage.prototype.available = function available(resource: ResourceType = u.RESOURCE_ALL): number {
  return u.store_resource_amount(this.store, resource);
};
StructureStorage.prototype.freeSpace = function freeSpace(__?: ResourceType): number {
  return this.store.getFreeCapacity();
};
StructureStorage.prototype.capacity = function capacity(): number {
  return this.store.getCapacity();
};
StructureStorage.prototype.link = function link(): StructureLink | undefined {
  return (this._link instanceof StructureLink) ? this._link : undefined;
};

StructureTerminal.prototype.available = function available(resource: ResourceType = u.RESOURCE_ALL): number {
  return u.store_resource_amount(this.store, resource);
};
StructureTerminal.prototype.freeSpace = function freeSpace(_r?: ResourceType): number {
  return this.store.getFreeCapacity();
};
StructureTerminal.prototype.capacity = function capacity(): number {
  return this.store.getCapacity();
};

StructureTower.prototype.available = function available(resource: ResourceType = u.RESOURCE_ALL): number {
  return u.limited_store_resource_amount(this.store, resource, RESOURCE_ENERGY);
};
StructureTower.prototype.freeSpace = function freeSpace(resource: ResourceType = u.RESOURCE_ALL): number {
  return u.resource_matches_type(RESOURCE_ENERGY, resource) ? this.store.getFreeCapacity(RESOURCE_ENERGY) : 0;
};
StructureTower.prototype.capacity = function capacity(): number {
  return this.store.getCapacity(RESOURCE_ENERGY);
};

Creep.prototype.available = function available(resource: ResourceType = u.RESOURCE_ALL): number {
  return u.store_resource_amount(this.store, resource);
};
Creep.prototype.freeSpace = function freeSpace(__?: ResourceType): number {
  return this.store.getFreeCapacity();
};
Creep.prototype.capacity = function capacity(): number {
  return this.store.getCapacity();
};
Creep.prototype.isEmployed = function isEmployed(): boolean {
  return !!this._job;
};
Creep.prototype.setJob = function setJob(job?: Job.Model): void {
  this._job = job;
  if (job) {
    this.memory.job = job.id();
  } else {
    delete this.memory.job;
  }
};
Creep.prototype.getJob = function getJob(): Job.Model | undefined {
  return this._job;
};
Creep.prototype.setLastJob = function setLastJob(lastJob?: Job.Model): void {
  this._lastJob = lastJob;
  if (lastJob) {
    this.memory.lastJob = lastJob.id();
  } else {
    delete this.memory.lastJob;
  }
};
Creep.prototype.getLastJob = function getLastJob(): Job.Model | undefined {
  return this._lastJob;
};
Creep.prototype.setBusiness = function setBusiness(business?: Business.Model): void {
  this._business = business;
  if (business) {
    this.memory.business = business.id();
  } else {
    delete this.memory.business;
  }
};
Creep.prototype.getBusiness = function getBusiness(): Business.Model | undefined {
  return this._business;
};
