export interface Pos {
  x: number;
  y: number;
}

export interface Layout {
  spawn: Pos[];
  storage: Pos[];
  extension: Pos[];
  lab: Pos[];
  tower: Pos[];
  road: Pos[];
  terminal: Pos[];
  link: Pos[];
  nuker: Pos[];
  powerSpawn: Pos[];
  observer: Pos[];
}

export default class CityLayout {

}
