CREATE TYPE "TaskRecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

ALTER TABLE tasks
  ADD COLUMN recurrence_frequency "TaskRecurrenceFrequency",
  ADD COLUMN recurrence_interval INTEGER,
  ADD COLUMN recurrence_generated_from_task_id UUID;

CREATE UNIQUE INDEX tasks_recurrence_generated_from_task_id_key
  ON tasks(recurrence_generated_from_task_id);

CREATE INDEX tasks_workspace_id_recurrence_frequency_idx
  ON tasks(workspace_id, recurrence_frequency);

ALTER TABLE tasks
  ADD CONSTRAINT tasks_recurrence_generated_from_task_id_fkey
  FOREIGN KEY (recurrence_generated_from_task_id) REFERENCES tasks(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_recurrence_interval_positive
  CHECK (recurrence_interval IS NULL OR recurrence_interval > 0);
