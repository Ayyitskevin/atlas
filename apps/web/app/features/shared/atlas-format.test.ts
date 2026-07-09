import { describe, expect, it } from "vitest";

import {
  dateInputValue,
  formatActivityDetail,
  formatActivityMetadata,
  formatActivityTitle,
  formatBytes,
  formatEventType,
  invitationStatus,
  projectRoleLabel,
  taskRecurrenceLabel,
  taskStatusLabel,
  workspaceRoleLabel,
} from "./atlas-format";

describe("atlas format helpers", () => {
  it("formats byte counts for attachment metadata", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(1024 * 1024 * 12)).toBe("12 MB");
  });

  it("formats event and status labels", () => {
    expect(formatEventType("TaskCompleted")).toBe("Task Completed");
    expect(formatActivityTitle("AttachmentDeleted")).toBe("Attachment removed");
    expect(formatActivityTitle("TaskLabelAdded")).toBe("Label added");
    expect(formatActivityTitle("TaskWatched")).toBe("Follower added");
    expect(formatActivityTitle("ProjectMessageCreated")).toBe("Message posted");
    expect(formatActivityTitle("ProjectTemplateCreated")).toBe("Template saved");
    expect(formatActivityTitle("ProjectTemplateUpdated")).toBe("Template updated");
    expect(formatActivityTitle("ProjectCreatedFromTemplate")).toBe("Project created from template");
    expect(formatActivityTitle("TaskDependencyAdded")).toBe("Dependency added");
    expect(formatActivityTitle("AttachmentReplaced")).toBe("Attachment replaced");
    expect(formatActivityTitle("AttachmentUpdated")).toBe("Attachment updated");
    expect(formatActivityTitle("AttachmentCommentCreated")).toBe("File comment added");
    expect(formatActivityTitle("TaskRecurrenceGenerated")).toBe("Recurring task created");
    expect(formatActivityTitle("TaskRecurrencePaused")).toBe("Recurring task paused");
    expect(formatActivityTitle("TaskRecurrenceSkipped")).toBe("Recurring task skipped");
    expect(formatActivityTitle("CustomEvent")).toBe("Custom Event");
    expect(taskStatusLabel("IN_PROGRESS")).toBe("in progress");
    expect(taskRecurrenceLabel("WEEKLY", 2)).toBe("every 2 weeks");
    expect(taskRecurrenceLabel("DAILY", 1)).toBe("daily");
    expect(workspaceRoleLabel("OWNER")).toBe("owner");
    expect(projectRoleLabel("PROJECT_ADMIN")).toBe("project admin");
  });

  it("formats activity details from payload context", () => {
    expect(formatActivityDetail({ entityType: "subtask", eventType: "SubtaskUpdated", payload: { title: "Draft QA" }, taskId: "task-1" })).toBe(
      "subtask: Draft QA",
    );
    expect(
      formatActivityDetail({
        entityType: "attachment",
        eventType: "AttachmentDeleted",
        payload: { fileName: "brief.pdf", sizeBytes: 2048 },
        taskId: "task-1",
      }),
    ).toBe("File: brief.pdf · 2.0 KB");
    expect(
      formatActivityMetadata({
        entityType: "attachment",
        eventType: "AttachmentUpdated",
        payload: { description: "Needs legal approval.", fileName: "brief.pdf", sizeBytes: 2048 },
        taskId: "task-1",
      }),
    ).toEqual([
      { label: "Size", value: "2.0 KB" },
      { label: "Note", value: "Needs legal approval." },
    ]);
    expect(
      formatActivityDetail({
        entityType: "attachment_comment",
        eventType: "AttachmentCommentCreated",
        payload: { fileName: "brief.pdf", sizeBytes: 2048, version: 1 },
        taskId: "task-1",
      }),
    ).toBe("File: brief.pdf · 2.0 KB");
    expect(
      formatActivityMetadata({
        entityType: "attachment_comment",
        eventType: "AttachmentCommentCreated",
        payload: { fileName: "brief.pdf", sizeBytes: 2048, version: 1 },
        taskId: "task-1",
      }),
    ).toEqual([
      { label: "Size", value: "2.0 KB" },
      { label: "Version", value: "v1" },
    ]);
    expect(
      formatActivityMetadata({
        entityType: "attachment",
        eventType: "AttachmentReplaced",
        payload: { fileName: "brief-v2.pdf", previousFileName: "brief.pdf", previousSizeBytes: 2048, sizeBytes: 4096, version: 2 },
        taskId: "task-1",
      }),
    ).toEqual([
      { label: "Size", value: "4.0 KB" },
      { label: "Version", value: "v2" },
      { label: "Previous file", value: "brief.pdf · 2.0 KB" },
    ]);
    expect(formatActivityDetail({ entityType: "project", eventType: "ProjectUpdated", payload: {}, projectId: "project-1" })).toBe(
      "Project activity",
    );
    expect(
      formatActivityDetail({
        entityType: "task",
        eventType: "TaskLabelAdded",
        payload: { name: "Client Review", title: "Prep launch QA" },
        taskId: "task-1",
      }),
    ).toBe("Task: Prep launch QA · label Client Review");
    expect(
      formatActivityDetail({
        entityType: "project_message",
        eventType: "ProjectMessageCreated",
        payload: { title: "Weekly update" },
        projectId: "project-1",
      }),
    ).toBe("project message: Weekly update");
    expect(
      formatActivityDetail({
        entityType: "project_template",
        eventType: "ProjectTemplateCreated",
        payload: { name: "Launch template" },
        projectId: "project-1",
      }),
    ).toBe("project template: Launch template");
    expect(
      formatActivityDetail({
        entityType: "task_dependency",
        eventType: "TaskDependencyAdded",
        payload: { blockedTaskTitle: "Client review", blockingTaskTitle: "Design draft" },
        taskId: "task-1",
      }),
    ).toBe("Task: Client review · blocked by Design draft");
    expect(
      formatActivityMetadata({
        entityType: "task_dependency",
        eventType: "TaskDependencyAdded",
        payload: { blockedTaskTitle: "Client review", blockingTaskTitle: "Design draft" },
        taskId: "task-1",
      }),
    ).toEqual([
      { label: "Blocked", value: "Client review" },
      { label: "Blocked by", value: "Design draft" },
    ]);
    expect(
      formatActivityTitle("TaskDependencyUnblocked"),
    ).toBe("Task unblocked");
    expect(
      formatActivityDetail({
        entityType: "task_dependency",
        eventType: "TaskDependencyUnblocked",
        payload: { blockedTaskTitle: "Client review", blockingTaskTitle: "Design draft" },
        taskId: "task-1",
      }),
    ).toBe("Task: Client review · unblocked after Design draft completed");
    expect(
      formatActivityDetail({
        entityType: "task",
        eventType: "TaskWatched",
        payload: { title: "Prep launch QA", user: { email: "watcher@example.com", name: "Watcher" } },
        taskId: "task-1",
      }),
    ).toBe("Task: Prep launch QA · follower Watcher");
  });

  it("formats task audit transitions from activity payloads", () => {
    const activity = {
      entityType: "task",
      eventType: "TaskCompleted",
      payload: {
        dueDate: "2026-07-05",
        previousDueDate: null,
        previousStatus: "IN_PROGRESS",
        priority: "HIGH",
        recurrenceEndDate: "2026-08-01",
        recurrenceFrequency: "WEEKLY",
        recurrenceInterval: 2,
        status: "DONE",
        title: "Prep launch QA",
      },
      taskId: "task-1",
    };

    expect(formatActivityDetail(activity)).toBe(
      "Task: Prep launch QA · in progress -> done · high priority · due 2026-07-05 · every 2 weeks · until 2026-08-01",
    );
    expect(formatActivityMetadata(activity)).toEqual([
      { label: "Status", value: "in progress -> done" },
      { label: "Priority", value: "high" },
      { label: "Due", value: "2026-07-05" },
      { label: "Repeat", value: "every 2 weeks" },
      { label: "Repeat until", value: "2026-08-01" },
    ]);

    const pausedActivity = {
      entityType: "task",
      eventType: "TaskRecurrencePaused",
      payload: {
        priority: "MEDIUM",
        recurrenceFrequency: "DAILY",
        recurrenceInterval: 1,
        recurrencePausedAt: "2026-07-03T20:30:00.000Z",
        status: "TODO",
        title: "Daily review",
      },
      taskId: "task-2",
    };

    expect(formatActivityDetail(pausedActivity)).toBe("Task: Daily review · todo · medium priority · daily · paused");
    expect(formatActivityMetadata(pausedActivity)).toContainEqual({ label: "Repeat state", value: "paused" });
  });

  it("formats project and project member audit metadata", () => {
    expect(
      formatActivityDetail({
        entityType: "project",
        eventType: "ProjectUpdated",
        payload: { archivedAt: null, name: "Atlas Launch", visibility: "PRIVATE" },
        projectId: "project-1",
      }),
    ).toBe("Project: Atlas Launch · private");

    const memberEvent = {
      entityType: "project_member",
      eventType: "ProjectMemberUpdated",
      payload: {
        previousRole: "VIEWER",
        role: "EDITOR",
        user: { email: "teammate@example.com", name: "Teammate" },
      },
      projectId: "project-1",
    };

    expect(formatActivityDetail(memberEvent)).toBe("Member: Teammate · viewer -> editor");
    expect(formatActivityMetadata(memberEvent)).toEqual([
      { label: "Member", value: "teammate@example.com" },
      { label: "Role", value: "viewer -> editor" },
    ]);
  });

  it("derives invitation status from lifecycle timestamps", () => {
    expect(invitationStatus({ expiresAt: "2999-01-01T00:00:00.000Z" })).toBe("pending");
    expect(invitationStatus({ acceptedAt: "2026-01-01T00:00:00.000Z", expiresAt: "2999-01-01T00:00:00.000Z" })).toBe("accepted");
    expect(invitationStatus({ canceledAt: "2026-01-01T00:00:00.000Z", expiresAt: "2999-01-01T00:00:00.000Z" })).toBe("canceled");
    expect(invitationStatus({ declinedAt: "2026-01-01T00:00:00.000Z", expiresAt: "2999-01-01T00:00:00.000Z" })).toBe("declined");
    expect(invitationStatus({ expiresAt: "2000-01-01T00:00:00.000Z" })).toBe("expired");
  });

  it("normalizes API dates for date inputs", () => {
    expect(dateInputValue("2026-06-29T00:00:00.000Z")).toBe("2026-06-29");
    expect(dateInputValue(null)).toBe("");
  });
});
