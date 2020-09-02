import { Operation } from 'Operation';

export default interface Work {
  id(): string;
  priority(): number;
  work(): Operation[];
}
