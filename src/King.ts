import { City } from "./City";
import { Work } from "./Work"
import { Operation } from "./Operation"
import { log } from "./lib/logger/log"

export class King {

  private _cities : City[];
  private _name : string;

  constructor() {
    let myRooms = _.select(Game.rooms, (room : Room) => { return room.controller? room.controller.my : false });
    let controller = (myRooms.length)? myRooms[0].controller : undefined;
    this._name = (controller)? controller.owner.username : "of-nothing";
    this._cities = _.map(myRooms, (room : Room) : City => { return new City(room); });
    log.debug(`${this}: ${this._cities.length} cities`)
  }

  id() : string {
    return `king-${this._name}`
  }


  toString() : string {
    return this.id();
  }

  survey() : void {
    log.debug(`${this} surveying...`);
    _.each(this._cities, (city : City) => { city.mayor.survey(); });
  }

  report() : string[] {
    let r = new Array<string>();
    r.push(`* Royal report by ${this}`);
    _.each(this._cities, (city : City) => { r.concat(city.mayor.report()); });
    return r;
  }

  rule() : Operation[] {
    log.debug(`${this} about to rule the world...`);
    this.survey();

    const ops = _.reduce(
      this._cities,
      function(res : Operation[], city : City) : Operation[] {
        return res.concat(_.flatten(_.map(
          city.mayor.work(),
          (work : Work) : Operation[] => {
            return work.work();
          })));
      },
      []);

    log.debug(`${this} has ${ops.length} operations scheduled...`);

    return ops;
  }

  save() : void {
    _.each(this._cities, (city : City) => { city.mayor.save(); });
  }
}
