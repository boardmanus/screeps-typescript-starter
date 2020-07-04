import * as Job from "Job";

/**
 * An Expert in a specific field.
 * Surveys the existing environment, and generates work to be done.
 * Provides reports on what is going on.
 */
export interface Expert {
  id(): string;
  survey(): void;
  schedule(): Job.Model[];
  report(): string[];
  save(): void;
}
