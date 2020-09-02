import Executive from 'Executive';

export type CloneRequest = {
  home: Room;
  ceo: Executive;
};

export interface Model {
  id(): string;
  type(): string;
  rooms(): Room[];
  parent(): Model | undefined;
  cloneRequest(request: CloneRequest): boolean;
}
