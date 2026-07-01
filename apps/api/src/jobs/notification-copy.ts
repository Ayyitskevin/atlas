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
    case "TaskMoved":
      return { body: quote(title) + " moved to another section.", title: "Task moved" };
    case "TaskAssigned":
      return { body: "Assignment changed for " + quote(title) + ".", title: "Task assigned" };
    case "TaskUnassigned":
      return { body: "Assignment changed for " + quote(title) + ".", title: "Task unassigned" };
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
