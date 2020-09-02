import { mock } from 'jest-mock-extended';
import { mockInstanceOf } from 'screeps-jest';
import * as Job from 'Job';

describe('Job Module', () => {

  describe('jobMoveTo', () => {

    it('return a tired result if creep fatigued', () => {
      const worker = mockInstanceOf<Creep>({ fatigue: 1 });
      const job = mock<Job.Model>();

      const res = Job.moveTo(job, worker, 0);
      expect(res).toEqual(ERR_TIRED);
    });
  });
});
