import { prisma } from "@atlas/db";

import { ActivityService } from "../activity/activity.service.js";
import { AttachmentsService } from "../attachments/attachments.service.js";
import { CommentsService } from "../comments/comments.service.js";
import { DependenciesService } from "../dependencies/dependencies.service.js";
import { DomainEventsRepository } from "../events/domain-events.repository.js";
import { LabelsService } from "../labels/labels.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { SearchService } from "../search/search.service.js";
import { SectionsService } from "../sections/sections.service.js";
import { SubtasksService } from "../subtasks/subtasks.service.js";
import { TasksService } from "../tasks/tasks.service.js";
import { WorkRepository } from "./work.repository.js";
import { WorkService } from "./work.service.js";

function deps() {
  return {
    workRepository: new WorkRepository(prisma),
    events: new DomainEventsRepository(prisma),
    permissions: new PermissionsService(prisma),
  };
}

/** @deprecated Prefer create*Service helpers for domain packages. */
export function createWorkService(): WorkService {
  const { workRepository, events, permissions } = deps();
  return new WorkService(workRepository, events, permissions);
}

export function createSectionsService() {
  const d = deps();
  return new SectionsService(d.workRepository, d.events, d.permissions);
}
export function createTasksService() {
  const d = deps();
  return new TasksService(d.workRepository, d.events, d.permissions);
}
export function createLabelsService() {
  const d = deps();
  return new LabelsService(d.workRepository, d.events, d.permissions);
}
export function createDependenciesService() {
  const d = deps();
  return new DependenciesService(d.workRepository, d.events, d.permissions);
}
export function createSubtasksService() {
  const d = deps();
  return new SubtasksService(d.workRepository, d.events, d.permissions);
}
export function createCommentsService() {
  const d = deps();
  return new CommentsService(d.workRepository, d.events, d.permissions);
}
export function createAttachmentsService() {
  const d = deps();
  return new AttachmentsService(d.workRepository, d.events, d.permissions);
}
export function createActivityService() {
  const d = deps();
  return new ActivityService(d.workRepository, d.events, d.permissions);
}
export function createNotificationsService() {
  const d = deps();
  return new NotificationsService(d.workRepository, d.events, d.permissions);
}
export function createSearchService() {
  const d = deps();
  return new SearchService(d.workRepository, d.events, d.permissions);
}
