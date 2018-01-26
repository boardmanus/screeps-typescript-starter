interface RoomPosition {
  surroundingPositions(radius : number, filter? : (p : RoomPosition) => boolean) : RoomPosition[];
}

interface RoomObject {
  availableEnergy() : number;
  freeSpace(resource? : ResourceConstant) : number;
  capacity() : number;
}

interface Creep {
  _employed : boolean;
  _lastJobSite : RoomObject;
  setEmployed(employed : boolean) : void;
  isEmployed() : boolean;
  setLastJobSite(lastJobSite : RoomObject) : void;
  getLastJobSite() : RoomObject|undefined;
}

interface Source {
  _container : StructureContainer|null;
  _tower : StructureTower|null;
  _link : StructureLink|null;
}

interface StructureStorage {
  _link : StructureLink|null;
}

interface StructureSpawn {
  _link : StructureLink|null;
}



RoomPosition.prototype.surroundingPositions = function (radius : number, filter? : (p : RoomPosition) => boolean) : RoomPosition[] {
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

RoomObject.prototype.availableEnergy = function() : number {
  return 0;
}
RoomObject.prototype.freeSpace = function(_? : ResourceConstant) : number {
  return 0;
}
RoomObject.prototype.capacity = function() : number {
  return 0;
}

Resource.prototype.availableEnergy = function() : number {
  if (this.resourceType == RESOURCE_ENERGY) {
    return this.amount;
  }
  return 0;
}

Source.prototype.availableEnergy = function() : number {
  return this.energy;
}

StructureExtension.prototype.availableEnergy = function() : number {
  return this.energy;
}
StructureExtension.prototype.freeSpace = function (resource? : ResourceConstant) : number {
  return (!resource || (resource == RESOURCE_ENERGY))? this.energyCapacity - this.energy : 0;
}
StructureExtension.prototype.capacity = function() : number {
  return this.energyCapacity;
}

StructureLink.prototype.availableEnergy = function() : number {
  return this.energy;
}
StructureLink.prototype.freeSpace = function (resource? : ResourceConstant) : number {
  return (!resource || (resource == RESOURCE_ENERGY))? this.energyCapacity - this.energy : 0;
}
StructureLink.prototype.capacity = function() : number {
  return this.energyCapacity;
}

StructureSpawn.prototype.availableEnergy = function() : number {
  return this.energy;
}
StructureSpawn.prototype.freeSpace = function (resource? : ResourceConstant) : number {
  return (!resource || (resource == RESOURCE_ENERGY))? this.energyCapacity - this.energy : 0;
}
StructureSpawn.prototype.capacity = function() : number {
  return this.energyCapacity;
}

StructureContainer.prototype.availableEnergy = function() : number {
  return this.store[RESOURCE_ENERGY];
}
StructureContainer.prototype.freeSpace = function (__? : ResourceConstant) : number {
  return this.storeCapacity - _.sum(this.store);
}
StructureContainer.prototype.capacity = function() : number {
  return this.storeCapacity;
}

StructureStorage.prototype.availableEnergy = function() : number {
  return this.store[RESOURCE_ENERGY];
}
StructureStorage.prototype.freeSpace = function (__? : ResourceConstant) : number {
  return this.storeCapacity - _.sum(this.store);
}
StructureStorage.prototype.capacity = function() : number {
  return this.storeCapacity;
}

StructureTower.prototype.availableEnergy = function() : number {
  return this.energy;
}
StructureTower.prototype.freeSpace = function (resource? : ResourceConstant) : number {
  return (!resource || (resource == RESOURCE_ENERGY))? this.energyCapacity - this.energy : 0;
}
StructureTower.prototype.capacity = function() : number {
  return this.energyCapacity;
}

Creep.prototype.availableEnergy = function() : number {
  return this.carry[RESOURCE_ENERGY];
}
Creep.prototype.freeSpace = function (__? : ResourceConstant) : number {
  return this.carryCapacity - _.sum(this.carry);
}
Creep.prototype.capacity = function() : number {
  return this.carryCapacity;
}
Creep.prototype.setEmployed = function(employed : boolean) : void {
  this._employed = employed;
}
Creep.prototype.isEmployed = function() : boolean {
  return this._employed;
}
Creep.prototype.setLastJobSite = function(lastJobSite : RoomObject) : void {
  this._lastJobSite = lastJobSite;
}
Creep.prototype.getLastJobSite = function() : RoomObject {
  return this._lastJobSite;
}
