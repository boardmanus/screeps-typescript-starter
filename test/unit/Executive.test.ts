import { expect } from 'chai';
import "../../src/types.impl";
import Executive from '../../src/Executive';

describe('Executive', () => {
  it('can be created from ExecutiveMemory', () => {
    Executive.fromMemory(<ExecutiveMemory>{
      business: "bus-id",
      employees: [],
      contractors: []
    });
  })
});
