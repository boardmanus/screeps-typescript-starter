import { throws } from "assert";



export class RoomCache {

  readonly room: Room;

  private _sources: Source[] | undefined;

  constructor(room: Room) {
    this.room = room;
    room._cache = this;
  }

  get sources(): Source[] {
    return this._sources ?? this.room.find(FIND_SOURCES);
  }
}

export default function Room$(room: Room): RoomCache {
  return room._cache;
}
