import type { FastifyInstance } from "fastify";

import { registerActivityRoutes } from "../activity/activity.routes.js";
import { registerAttachmentsRoutes } from "../attachments/attachments.routes.js";
import { registerCommentsRoutes } from "../comments/comments.routes.js";
import { registerDependenciesRoutes } from "../dependencies/dependencies.routes.js";
import { registerLabelsRoutes } from "../labels/labels.routes.js";
import { registerNotificationsRoutes } from "../notifications/notifications.routes.js";
import { registerSearchRoutes } from "../search/search.routes.js";
import { registerSectionsRoutes } from "../sections/sections.routes.js";
import { registerSubtasksRoutes } from "../subtasks/subtasks.routes.js";
import { registerTasksRoutes } from "../tasks/tasks.routes.js";

/** Registers all work-domain route plugins. HTTP paths unchanged from monolithic work routes. */
export async function registerWorkRoutes(app: FastifyInstance): Promise<void> {
  await registerSectionsRoutes(app);
  await registerTasksRoutes(app);
  await registerLabelsRoutes(app);
  await registerDependenciesRoutes(app);
  await registerSubtasksRoutes(app);
  await registerCommentsRoutes(app);
  await registerAttachmentsRoutes(app);
  await registerActivityRoutes(app);
  await registerNotificationsRoutes(app);
  await registerSearchRoutes(app);
}
