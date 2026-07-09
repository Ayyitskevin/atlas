import {
  ATLAS_ERROR_CODES,
  type CreateTaskRequest,
  type UpdateTaskRequest,
} from "@atlas/shared";
import { Prisma, type TaskPriority, type TaskRecurrenceFrequency } from "@atlas/db";

import type { AuthContext } from "../../shared/auth-context.js";
import { AtlasHttpError } from "../../shared/errors.js";
import {
  attachmentScanBlockReason,
  attachmentScanner,
  attachmentScannerErrorResult,
  type AttachmentScanner,
  type AttachmentScanResult,
} from "../../storage/attachment-scanner.js";
import {
  getAttachmentObjectMetadata,
  type AttachmentObjectMetadata,
} from "../../storage/object-storage.js";
import { DomainEventsRepository } from "../events/domain-events.repository.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { defaultListPosition } from "./position.js";
import { nextRecurringDueDate } from "./task-recurrence.js";
import { WorkRepository } from "./work.repository.js";
import { emptyDependencySummary, normalizeMimeType, taskAuditPayload, type TaskDependencySummary } from "./work-helpers.js";

function datePayloadValue(value?: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function dateTimeOrNull(value?: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function isPrismaUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Shared repository, events, permissions, and protected helpers for work-domain services. */
export class WorkDomainBase {
  constructor(
    protected readonly workRepository: WorkRepository,
    protected readonly events: DomainEventsRepository,
    protected readonly permissions: PermissionsService,
    protected readonly scanner: AttachmentScanner = attachmentScanner,
  ) {}

  /** Permission-checked task load shared across domains (comments, labels, attachments, …). */
  protected async getTask(ctx: AuthContext, workspaceId: string, taskId: string) {
    await this.permissions.requireTaskRole(ctx, workspaceId, taskId, "VIEWER");
    const task = await this.workRepository.findTask(workspaceId, taskId);
    if (!task) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Task not found.");
    return task;
  }

  protected async assertAttachmentObjectMatches(input: { mimeType: string; objectKey: string; sizeBytes: number }): Promise<AttachmentObjectMetadata> {
    const metadata = await getAttachmentObjectMetadata(input.objectKey);
    if (!metadata) {
      throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, "Attachment upload has not finished.", {
        objectKey: input.objectKey,
        reason: "missing",
      });
    }

    if (metadata.contentLength !== input.sizeBytes) {
      throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, "Uploaded attachment size does not match the requested file.", {
        actualSizeBytes: metadata.contentLength,
        expectedSizeBytes: input.sizeBytes,
        objectKey: input.objectKey,
        reason: "size_mismatch",
      });
    }

    if (normalizeMimeType(metadata.contentType) !== normalizeMimeType(input.mimeType)) {
      throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, "Uploaded attachment type does not match the requested file.", {
        actualMimeType: metadata.contentType,
        expectedMimeType: input.mimeType,
        objectKey: input.objectKey,
        reason: "mime_type_mismatch",
      });
    }

    return metadata;
  }


  protected async scanInitialAttachment(input: {
    attachmentId: string;
    fileName: string;
    mimeType: string;
    objectKey: string;
    sizeBytes: number;
    workspaceId: string;
  }): Promise<AttachmentScanResult> {
    const metadata = await this.assertAttachmentObjectMatches(input);
    const scan = await this.scanAttachmentObject({ ...input, metadata });
    const blockReason = attachmentScanBlockReason(scan);
    if (blockReason) {
      await this.workRepository.recordAttachmentScanResult({ attachmentId: input.attachmentId, scan, workspaceId: input.workspaceId });
      this.throwAttachmentScanConflict(input.objectKey, scan, blockReason);
    }
    return scan;
  }


  protected async scanAttachmentVersion(input: {
    fileName: string;
    mimeType: string;
    objectKey: string;
    sizeBytes: number;
    versionId: string;
    workspaceId: string;
  }): Promise<AttachmentScanResult> {
    const metadata = await this.assertAttachmentObjectMatches(input);
    const scan = await this.scanAttachmentObject({ ...input, metadata });
    const blockReason = attachmentScanBlockReason(scan);
    if (blockReason) {
      await this.workRepository.recordAttachmentVersionScanResult({ scan, versionId: input.versionId, workspaceId: input.workspaceId });
      this.throwAttachmentScanConflict(input.objectKey, scan, blockReason);
    }
    return scan;
  }


  protected async scanAttachmentObject(input: {
    fileName: string;
    metadata: AttachmentObjectMetadata;
    mimeType: string;
    objectKey: string;
    sizeBytes: number;
    workspaceId: string;
  }): Promise<AttachmentScanResult> {
    try {
      return await this.scanner.scan(input);
    } catch (error) {
      return attachmentScannerErrorResult(error);
    }
  }


  protected throwAttachmentScanConflict(objectKey: string, scan: AttachmentScanResult, reason: "infected" | "scanner_error"): never {
    throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, reason === "infected" ? "Attachment scan detected unsafe content." : "Attachment scan could not verify the upload.", {
      objectKey,
      provider: scan.provider,
      reason,
      scanMessage: scan.message,
      scanStatus: scan.status,
    });
  }


  protected async requireSectionInProject(workspaceId: string, projectId: string, sectionId: string) {
    const section = await this.workRepository.findSection({ projectId, sectionId, workspaceId });
    if (!section) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Section not found in this Project.");
  }


  protected async requireSectionsInProject(workspaceId: string, projectId: string, sectionIds: string[]) {
    const ids = [...new Set(sectionIds)];
    const count = await this.workRepository.countSections({ projectId, sectionIds: ids, workspaceId });
    if (count !== ids.length) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "One or more Sections were not found in this Project.");
  }


  protected async requireWorkspaceMembers(workspaceId: string, userIds: string[]) {
    const ids = [...new Set(userIds)];
    if (!ids.length) return;
    const count = await this.workRepository.countWorkspaceMembers({ userIds: ids, workspaceId });
    if (count !== ids.length) {
      throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "One or more assignees are not active members of this Workspace.");
    }
  }


  protected async withDependencySummaries<TTask extends { id: string }>(workspaceId: string, tasks: TTask[]) {
    const summaries = await this.dependencySummaryMap(
      workspaceId,
      tasks.map((task) => task.id),
    );

    return tasks.map((task) => ({
      ...task,
      dependencySummary: summaries.get(task.id) ?? emptyDependencySummary(),
    }));
  }


  protected async dependencySummaryMap(workspaceId: string, taskIds: string[]) {
    const summaries = new Map<string, TaskDependencySummary>();
    const ids = [...new Set(taskIds)];
    for (const taskId of ids) summaries.set(taskId, emptyDependencySummary());

    const rows = await this.workRepository.listTaskDependencySummaryRows({
      taskIds: ids,
      workspaceId,
    });

    for (const row of rows) {
      const blocked = summaries.get(row.blockedTaskId);
      if (blocked && row.blockingTask.status !== "DONE") {
        blocked.blockedByOpenCount += 1;
        blocked.isBlocked = true;
      }

      const blocking = summaries.get(row.blockingTaskId);
      if (blocking) blocking.blocksCount += 1;
    }

    return summaries;
  }


  protected async requireTaskNotBlocked(workspaceId: string, taskId: string) {
    const rows = await this.workRepository.listTaskDependencySummaryRows({ taskIds: [taskId], workspaceId });
    const openBlockerCount = rows.filter((row) => row.blockedTaskId === taskId && row.blockingTask.status !== "DONE").length;
    if (openBlockerCount) {
      throw new AtlasHttpError(
        409,
        ATLAS_ERROR_CODES.CONFLICT,
        "Complete open blocking tasks before completing this task.",
        { openBlockerCount },
      );
    }
  }


  protected async recordTasksUnblockedByCompletion(
    ctx: AuthContext,
    workspaceId: string,
    blockingTask: { id: string; title: string },
  ) {
    const rows = await this.workRepository.listTasksUnblockedByCompletion({
      blockingTaskId: blockingTask.id,
      workspaceId,
    });
    const unblockedRows = rows.filter((row) => row.blockedTask.dependenciesAsBlocked.length === 0);

    await Promise.all(
      unblockedRows.map((row) =>
        this.events.recordActivity({
          actorUserId: ctx.userId,
          entityId: row.id,
          entityType: "task_dependency",
          eventType: "TaskDependencyUnblocked",
          payload: {
            blockedTaskId: row.blockedTaskId,
            blockedTaskTitle: row.blockedTask.title,
            blockingTaskId: blockingTask.id,
            blockingTaskTitle: blockingTask.title,
          },
          projectId: row.blockedTask.projectId,
          taskId: row.blockedTaskId,
          workspaceId,
        }),
      ),
    );
  }


  protected createRecurrence(input: CreateTaskRequest) {
    if ((input.recurrenceInterval !== undefined || input.recurrenceEndDate !== undefined) && !input.recurrenceFrequency) {
      throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "Recurring tasks require a recurrence frequency.");
    }
    return {
      recurrenceEndDate: input.recurrenceFrequency ? input.recurrenceEndDate ?? null : null,
      recurrenceFrequency: input.recurrenceFrequency ?? null,
      recurrenceInterval: input.recurrenceFrequency ? input.recurrenceInterval ?? 1 : null,
    };
  }


  protected updateRecurrence(
    input: UpdateTaskRequest,
    task: {
      recurrenceEndDate?: Date | string | null;
      recurrenceFrequency?: TaskRecurrenceFrequency | null;
      recurrenceInterval?: number | null;
      recurrencePausedAt?: Date | string | null;
    },
    now: Date,
  ) {
    if (input.recurrenceFrequency === null) {
      return { recurrenceEndDate: null, recurrenceFrequency: null, recurrenceInterval: null, recurrencePausedAt: null };
    }
    const recurrence = {
      recurrenceEndDate: datePayloadValue(task.recurrenceEndDate),
      recurrenceFrequency: task.recurrenceFrequency ?? null,
      recurrenceInterval: task.recurrenceInterval ?? null,
      recurrencePausedAt: dateTimeOrNull(task.recurrencePausedAt),
    };
    if (input.recurrenceFrequency !== undefined) {
      recurrence.recurrenceFrequency = input.recurrenceFrequency;
      recurrence.recurrenceInterval = input.recurrenceInterval ?? task.recurrenceInterval ?? 1;
    }
    if (input.recurrenceInterval === null) {
      return { recurrenceEndDate: null, recurrenceFrequency: null, recurrenceInterval: null, recurrencePausedAt: null };
    }
    if (input.recurrenceInterval !== undefined && input.recurrenceFrequency === undefined) {
      if (!recurrence.recurrenceFrequency) {
        throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "Recurring tasks require a recurrence frequency.");
      }
      recurrence.recurrenceInterval = input.recurrenceInterval;
    }
    if (input.recurrenceEndDate !== undefined) {
      if (input.recurrenceEndDate !== null && !recurrence.recurrenceFrequency) {
        throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "Recurring tasks require a recurrence frequency.");
      }
      recurrence.recurrenceEndDate = input.recurrenceEndDate;
    }
    if (input.recurrencePaused === true) {
      if (!recurrence.recurrenceFrequency) {
        throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "Only recurring tasks can be paused.");
      }
      recurrence.recurrencePausedAt = recurrence.recurrencePausedAt ?? now;
    }
    if (input.recurrencePaused === false) {
      recurrence.recurrencePausedAt = null;
    }
    if (!recurrence.recurrenceFrequency) {
      recurrence.recurrenceEndDate = null;
      recurrence.recurrenceInterval = null;
      recurrence.recurrencePausedAt = null;
    }
    if (
      input.recurrenceEndDate !== undefined ||
      input.recurrenceFrequency !== undefined ||
      input.recurrenceInterval !== undefined ||
      input.recurrencePaused !== undefined
    ) {
      return recurrence;
    }
    return {};
  }


  protected async createNextRecurringTask(
    ctx: AuthContext,
    workspaceId: string,
    task: {
      assignees: Array<{ userId: string }>;
      description?: string | null;
      dueDate?: Date | string | null;
      id: string;
      priority: TaskPriority;
      projectId: string;
      recurrenceEndDate?: Date | string | null;
      recurrenceFrequency?: TaskRecurrenceFrequency | null;
      recurrenceInterval?: number | null;
      recurrencePausedAt?: Date | string | null;
      sectionId: string;
      title: string;
    },
  ) {
    if (!task.recurrenceFrequency || !task.recurrenceInterval || task.recurrencePausedAt) return null;
    const nextDueDate = nextRecurringDueDate({
      dueDate: task.dueDate,
      frequency: task.recurrenceFrequency,
      interval: task.recurrenceInterval,
    });
    const recurrenceEndDate = datePayloadValue(task.recurrenceEndDate);
    if (recurrenceEndDate && nextDueDate > recurrenceEndDate) return null;
    try {
      const nextTask = await this.workRepository.createRecurringTask({
        assigneeIds: task.assignees.map((assignee) => assignee.userId),
        description: task.description,
        dueDate: nextDueDate,
        generatedFromTaskId: task.id,
        position: defaultListPosition(),
        priority: task.priority,
        projectId: task.projectId,
        recurrenceEndDate,
        recurrenceFrequency: task.recurrenceFrequency,
        recurrenceInterval: task.recurrenceInterval,
        sectionId: task.sectionId,
        title: task.title,
        workspaceId,
      });
      await this.events.recordActivity({
        actorUserId: ctx.userId,
        entityId: nextTask.id,
        entityType: "task",
        eventType: "TaskRecurrenceGenerated",
        payload: { ...taskAuditPayload(nextTask), generatedFromTaskId: task.id },
        projectId: task.projectId,
        taskId: nextTask.id,
        workspaceId,
      });
      return nextTask;
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) return null;
      throw error;
    }
  }

}
