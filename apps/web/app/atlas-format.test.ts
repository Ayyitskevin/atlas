import { describe, expect, it } from "vitest";

import {
  dateInputValue,
  formatActivityDetail,
  formatActivityTitle,
  formatBytes,
  formatEventType,
  invitationStatus,
  projectRoleLabel,
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
    expect(formatActivityTitle("CustomEvent")).toBe("Custom Event");
    expect(taskStatusLabel("IN_PROGRESS")).toBe("in progress");
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
    expect(formatActivityDetail({ entityType: "project", eventType: "ProjectUpdated", payload: {}, projectId: "project-1" })).toBe(
      "Project activity",
    );
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
