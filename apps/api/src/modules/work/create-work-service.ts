import { prisma } from "@atlas/db";

import { DomainEventsRepository } from "../events/domain-events.repository.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { WorkRepository } from "./work.repository.js";
import { WorkService } from "./work.service.js";

/** Shared composition root for work-domain controllers. */
export function createWorkService(): WorkService {
  return new WorkService(new WorkRepository(prisma), new DomainEventsRepository(prisma), new PermissionsService(prisma));
}
