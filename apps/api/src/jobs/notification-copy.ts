import type { MutationEventJob } from "./queues.js";

type NotificationCopy = {
  body: string;
  title: string;
};

export function taskNotificationCopy(event: MutationEventJob, taskTitle: string): NotificationCopy {
  const title = taskTitle.trim() || "Untitled task";
  switch (event.eventType) {
    case "TaskCompleted":
      return { body: quote(title) + " was marked complete.", title: "Task completed" };
    case "TaskRecurrenceGenerated":
      return { body: quote(title) + " was created from a recurring task.", title: "Recurring task created" };
    case "TaskRecurrencePaused":
      return { body: "The recurrence for " + quote(title) + " was paused.", title: "Recurring task paused" };
    case "TaskRecurrenceResumed":
      return { body: "The recurrence for " + quote(title) + " was resumed.", title: "Recurring task resumed" };
    case "TaskRecurrenceSkipped":
      return { body: quote(title) + " was skipped and advanced to the next occurrence.", title: "Recurring task skipped" };
    case "TaskMoved":
      return { body: quote(title) + " moved to another section.", title: "Task moved" };
    case "TaskAssigned":
      return { body: "Assignment changed for " + quote(title) + ".", title: "Task assigned" };
    case "TaskUnassigned":
      return { body: "Assignment changed for " + quote(title) + ".", title: "Task unassigned" };
    case "TaskLabelAdded":
      return { body: "A label was added to " + quote(title) + ".", title: "Label added" };
    case "TaskLabelRemoved":
      return { body: "A label was removed from " + quote(title) + ".", title: "Label removed" };
    case "TaskWatched":
      return { body: "A follower was added to " + quote(title) + ".", title: "Follower added" };
    case "TaskUnwatched":
      return { body: "A follower was removed from " + quote(title) + ".", title: "Follower removed" };
    case "TaskDependencyAdded": {
      const blockingTaskTitle = stringPayload(event.payload, "blockingTaskTitle");
      return {
        body: quote(title) + " is now blocked" + (blockingTaskTitle ? " by " + quote(blockingTaskTitle) : "") + ".",
        title: "Dependency added",
      };
    }
    case "TaskDependencyRemoved": {
      const blockingTaskTitle = stringPayload(event.payload, "blockingTaskTitle");
      return {
        body: quote(title) + " is no longer blocked" + (blockingTaskTitle ? " by " + quote(blockingTaskTitle) : "") + ".",
        title: "Dependency removed",
      };
    }
    case "TaskDependencyUnblocked": {
      const blockingTaskTitle = stringPayload(event.payload, "blockingTaskTitle");
      return {
        body: quote(title) + " is unblocked" + (blockingTaskTitle ? " because " + quote(blockingTaskTitle) + " was completed" : "") + ".",
        title: "Task unblocked",
      };
    }
    case "SubtaskCreated":
      return { body: "A subtask was added to " + quote(title) + ".", title: "Subtask added" };
    case "SubtaskUpdated":
      return { body: "A subtask changed on " + quote(title) + ".", title: "Subtask updated" };
    case "SubtaskDeleted":
      return { body: "A subtask was removed from " + quote(title) + ".", title: "Subtask removed" };
    case "CommentCreated":
      return { body: "A comment was added to " + quote(title) + ".", title: "New comment" };
    case "CommentUpdated":
      return { body: "A comment was edited on " + quote(title) + ".", title: "Comment edited" };
    case "CommentDeleted":
      return { body: "A comment was deleted from " + quote(title) + ".", title: "Comment deleted" };
    case "AttachmentAdded":
      return { body: "A file was attached to " + quote(title) + ".", title: "Attachment added" };
    case "AttachmentReplaced":
      return { body: "A file was replaced on " + quote(title) + ".", title: "Attachment replaced" };
    case "AttachmentUpdated":
      return { body: "A file note changed on " + quote(title) + ".", title: "Attachment updated" };
    case "AttachmentDeleted":
      return { body: "A file was removed from " + quote(title) + ".", title: "Attachment removed" };
    case "TaskUpdated":
      return { body: quote(title) + " was updated.", title: "Task updated" };
    default:
      return { body: "There is new activity on " + quote(title) + ".", title: "Task activity" };
  }
}

function quote(value: string): string {
  return '"' + value + '"';
}

function stringPayload(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : null;
}
