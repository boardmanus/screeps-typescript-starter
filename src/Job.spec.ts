import { mock } from 'jest-mock-extended';
import * as Job from 'Job';

global.log.debug = (..._args: any[]) => { };
global.log.info = (..._args: any[]) => { };
global.log.warning = (..._args: any[]) => { };
global.log.error = (..._args: any[]) => { };

describe('Job Module', () => {

  describe('jobMoveTo', () => {

    it('return a tired result if creep fatigued', () => {

      const worker = mock<Creep>({
        fatigue: 1,
        memory: { _move: { path: '' } }
      });
      const job = mock<Job.Model>();

      const res = Job.moveTo(job, worker, 0);
      expect(res).toEqual(ERR_TIRED);
    });
  });
});
