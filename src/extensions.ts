interface RoomPosition {
  surroundingPositions(radius : number, filter? : (p : RoomPosition) => boolean) : RoomPosition[];
}

interface RoomObject {
  available(resource? : ResourceConstant) : number;
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
  jobMoveTo(pos : RoomPosition|RoomObject, range : number, style : LineStyle) : number;
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

RoomObject.prototype.available = function(_? : ResourceConstant) : number {
  return 0;
}
RoomObject.prototype.freeSpace = function(_? : ResourceConstant) : number {
  return 0;
}
RoomObject.prototype.capacity = function() : number {
  return 0;
}

Resource.prototype.available = function(resource? : ResourceConstant) : number {
  if (!resource && this.resourceType == RESOURCE_ENERGY || this.resourceType == resource) {
    return this.amount;
  }
  return 0;
}

Source.prototype.available = function(resource? : ResourceConstant) : number {
  return (!resource || (resource == RESOURCE_ENERGY))? this.energy : 0;
}

StructureExtension.prototype.available = function(resource? : ResourceConstant) : number {
  return (!resource || (resource == RESOURCE_ENERGY))? this.energy : 0;
}
StructureExtension.prototype.freeSpace = function (resource? : ResourceConstant) : number {
  return (!resource || (resource == RESOURCE_ENERGY))? this.energyCapacity - this.energy : 0;
}
StructureExtension.prototype.capacity = function() : number {
  return this.energyCapacity;
}

StructureLink.prototype.available = function(resource? : ResourceConstant) : number {
  return (!resource || (resource == RESOURCE_ENERGY))? this.energy : 0;
}
StructureLink.prototype.freeSpace = function (resource? : ResourceConstant) : number {
  return (!resource || (resource == RESOURCE_ENERGY))? this.energyCapacity - this.energy : 0;
}
StructureLink.prototype.capacity = function() : number {
  return this.energyCapacity;
}

StructureSpawn.prototype.available = function(resource? : ResourceConstant) : number {
  return (!resource || (resource == RESOURCE_ENERGY))? this.energy : 0;
}
StructureSpawn.prototype.freeSpace = function (resource? : ResourceConstant) : number {
  return (!resource || (resource == RESOURCE_ENERGY))? this.energyCapacity - this.energy : 0;
}
StructureSpawn.prototype.capacity = function() : number {
  return this.energyCapacity;
}

StructureContainer.prototype.available = function(resource? : ResourceConstant) : number {
  return this.store[resource || RESOURCE_ENERGY] || 0;
}
StructureContainer.prototype.freeSpace = function (__? : ResourceConstant) : number {
  return this.storeCapacity - _.sum(this.store);
}
StructureContainer.prototype.capacity = function() : number {
  return this.storeCapacity;
}

StructureStorage.prototype.available = function(resource? : ResourceConstant) : number {
  return this.store[resource || RESOURCE_ENERGY] || 0;
}
StructureStorage.prototype.freeSpace = function (__? : ResourceConstant) : number {
  return this.storeCapacity - _.sum(this.store);
}
StructureStorage.prototype.capacity = function() : number {
  return this.storeCapacity;
}

StructureTower.prototype.available = function(resource? : ResourceConstant) : number {
  return (!resource || (resource == RESOURCE_ENERGY))? this.energy : 0;
}
StructureTower.prototype.freeSpace = function (resource? : ResourceConstant) : number {
  return (!resource || (resource == RESOURCE_ENERGY))? this.energyCapacity - this.energy : 0;
}
StructureTower.prototype.capacity = function() : number {
  return this.energyCapacity;
}

Creep.prototype.available = function(resource? : ResourceConstant) : number {
  return this.carry[resource || RESOURCE_ENERGY] || 0;
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
Creep.prototype.jobMoveTo = function(pos : RoomPosition|RoomObject, range : number, style : LineStyle) : number {

  const lastPosition = this.memory.lastPosition;
  const stuck = (
    lastPosition
    && lastPosition.x == this.pos.x
    && lastPosition.y == this.pos.y
    && lastPosition.roomName == this.pos.roomName);

  if (!stuck) {

    const res = this.moveTo(pos, { ignoreCreeps: true , range: range, reusePath: 20, visualizePathStyle: style });
    if (res == OK) {
      this.memory.lastPosition = this.pos;
      return res;
    }

    if (res != ERR_NO_PATH) {
      this.memory.lastPosition = undefined;
      return res;
    }

    console.log(`${this}: failed moving to ${pos} - reevaluating path`);
  }
  else {
    console.log(`${this}: stuck - reevaluating path`);
  }

  // Clear out the old move
  delete this.memory._move;

  // Re-evaluate the path, ensuring creeps aren't ignored this time.
  const res = this.moveTo(pos, { ignoreCreeps: false, range: range, reusePath: 20, visualizePathStyle: style});
  if (res != OK) {
    this.memory.lastPosition = undefined;
    return res;
  }

  this.memory.lastPosition = this.pos;
  return res;
}
