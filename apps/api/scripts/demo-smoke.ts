import type { FastifyInstance } from "fastify";

import { prisma } from "@atlas/db";
import { projectDependencyMapResponseSchema, type ProjectDependencyMapResponse } from "@atlas/shared";

import { buildApp } from "../src/app.js";
import { closeDomainSideEffectQueues } from "../src/jobs/queues.js";

const apiPrefix = "/api/v1";
const demoEmail = process.env.ATLAS_DEMO_EMAIL ?? "kevin@example.com";
const demoPassword = process.env.ATLAS_DEMO_PASSWORD ?? "atlas-demo-password";
const launchProjectId = "00000000-0000-0000-0000-000000000101";
const onboardingProjectId = "00000000-0000-0000-0000-000000000102";

type Page<T> = {
  items: T[];
  nextCursor?: string | null;
};

type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
};

type ProjectSummary = {
  id: string;
  name: string;
  visibility: string;
};

type WorkspaceMemberSummary = {
  role: string;
  user: {
    email: string;
    name: string;
  };
};

type TaskSummary = {
  dependencySummary?: {
    blockedByOpenCount: number;
    blocksCount: number;
    isBlocked: boolean;
  };
  id: string;
  priority: string;
  status: string;
  title: string;
};

type LabelSummary = {
  color: string;
  name: string;
};

type ProjectMessageSummary = {
  pinnedAt: string | null;
  title: string;
};

type ProjectTemplateSummary = {
  name: string;
};

type NotificationSummary = {
  readAt: string | null;
  title: string;
};

type NotificationPreference = {
  emailEnabled: boolean;
};

type AuthResponse = {
  accessToken: string;
};

async function main() {
  let app: FastifyInstance | undefined;

  try {
    app = await buildApp();
    await app.ready();

    const auth = await injectJson<AuthResponse>(app, {
      method: "POST",
      payload: { email: demoEmail, password: demoPassword },
      url: apiPrefix + "/auth/login",
    });
    assert(auth.accessToken.length > 0, "Demo login did not return an access token.");
    const headers = authHeaders(auth.accessToken);

    const workspacePage = await injectJson<Page<WorkspaceSummary>>(app, {
      headers,
      method: "GET",
      url: apiPrefix + "/workspaces?limit=50",
    });
    const workspace = findRequired(workspacePage.items, (item) => item.slug === "atlas-demo", "atlas-demo workspace");
    assert(workspace.name === "Atlas Demo Workspace", "Demo workspace name drifted.");

    const projects = await injectJson<Page<ProjectSummary>>(app, {
      headers,
      method: "GET",
      url: apiPrefix + "/workspaces/" + workspace.id + "/projects?limit=50",
    });
    const launch = findRequired(projects.items, (item) => item.id === launchProjectId, "Product Launch project");
    const onboarding = findRequired(projects.items, (item) => item.id === onboardingProjectId, "Client Onboarding project");
    assert(launch.name === "Product Launch" && launch.visibility === "WORKSPACE", "Product Launch project drifted.");
    assert(onboarding.name === "Client Onboarding" && onboarding.visibility === "PRIVATE", "Client Onboarding project drifted.");

    const members = await injectJson<{ items: WorkspaceMemberSummary[] }>(app, {
      headers,
      method: "GET",
      url: apiPrefix + "/workspaces/" + workspace.id + "/members",
    });
    expectNamedMember(members.items, "kevin@example.com", "OWNER");
    expectNamedMember(members.items, "maya@example.com", "ADMIN");
    expectNamedMember(members.items, "jon@example.com", "MEMBER");

    const labels = await injectJson<Page<LabelSummary>>(app, {
      headers,
      method: "GET",
      url: apiPrefix + "/workspaces/" + workspace.id + "/labels",
    });
    expectIncludedNames(labels.items, ["Client", "Launch", "Risk"], "demo labels");

    const tasks = await injectJson<Page<TaskSummary>>(app, {
      headers,
      method: "GET",
      url: apiPrefix + "/workspaces/" + workspace.id + "/projects/" + launch.id + "/tasks?dependency=any&limit=50",
    });
    expectIncludedNames(tasks.items, ["Book launch review meeting", "Draft customer announcement", "Finalize launch checklist", "QA signup and invite flow"], "launch tasks");
    const launchChecklist = findRequired(tasks.items, (item) => item.title === "Finalize launch checklist", "launch checklist task");
    assert(launchChecklist.dependencySummary?.isBlocked === true, "Launch checklist should be blocked by open QA work.");

    const dependencyMapPayload = await injectJson<unknown>(app, {
      headers,
      method: "GET",
      url: apiPrefix + "/workspaces/" + workspace.id + "/projects/" + launch.id + "/dependencies",
    });
    const dependencyMap = projectDependencyMapResponseSchema.parse(dependencyMapPayload);
    assertDependencyMap(dependencyMap);

    const messages = await injectJson<Page<ProjectMessageSummary>>(app, {
      headers,
      method: "GET",
      url: apiPrefix + "/workspaces/" + workspace.id + "/projects/" + launch.id + "/messages?limit=20",
    });
    const pinnedMessage = findRequired(messages.items, (item) => item.title === "Launch room operating note", "launch room operating note");
    assert(pinnedMessage.pinnedAt !== null, "Launch room operating note should be pinned.");

    const templates = await injectJson<{ items: ProjectTemplateSummary[] }>(app, {
      headers,
      method: "GET",
      url: apiPrefix + "/workspaces/" + workspace.id + "/project-templates",
    });
    expectIncludedNames(templates.items, ["Client Onboarding Playbook"], "project templates");

    const myWork = await injectJson<Page<TaskSummary>>(app, {
      headers,
      method: "GET",
      url: apiPrefix + "/workspaces/" + workspace.id + "/my-work?due=any&limit=50&status=open",
    });
    expectIncludedNames(myWork.items, ["Finalize launch checklist", "Prepare kickoff workspace"], "Kevin my-work");

    const notificationPreference = await injectJson<NotificationPreference>(app, {
      headers,
      method: "GET",
      url: apiPrefix + "/workspaces/" + workspace.id + "/notification-preferences",
    });
    assert(notificationPreference.emailEnabled, "Kevin demo notification email preference should be enabled.");

    const notifications = await injectJson<Page<NotificationSummary>>(app, {
      headers,
      method: "GET",
      url: apiPrefix + "/workspaces/" + workspace.id + "/notifications?limit=20&unreadOnly=true",
    });
    const commentNotification = findRequired(notifications.items, (item) => item.title === "New comment on Finalize launch checklist", "seeded comment notification");
    assert(commentNotification.readAt === null, "Seeded comment notification should start unread.");

    const chainTitles = dependencyMap.criticalPathTaskIds.map((taskId) => {
      const node = dependencyMap.nodes.find((item) => item.id === taskId);
      return node?.title ?? taskId;
    });
    console.info(
      JSON.stringify(
        {
          dependencyChain: chainTitles,
          labelCount: labels.items.length,
          launchTaskCount: tasks.items.length,
          notificationCount: notifications.items.length,
          projectCount: projects.items.length,
          templateCount: templates.items.length,
          workspace: workspace.slug,
        },
        null,
        2,
      ),
    );
    console.info("Atlas demo smoke passed.");
  } finally {
    if (app) await app.close();
    await closeDomainSideEffectQueues();
    await prisma.$disconnect();
  }
}

function authHeaders(accessToken: string) {
  return { authorization: "Bearer " + accessToken };
}

async function injectJson<T>(
  app: FastifyInstance,
  input: {
    headers?: Record<string, string>;
    method: "GET" | "POST";
    payload?: Record<string, unknown>;
    url: string;
  },
): Promise<T> {
  const response = await app.inject(input);
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(input.method + " " + input.url + " failed with " + response.statusCode + ": " + response.body);
  }
  return response.json<T>();
}

function assertDependencyMap(dependencyMap: ProjectDependencyMapResponse) {
  assert(dependencyMap.edges.length === 2, "Product Launch should have exactly two seeded dependency edges.");
  assert(dependencyMap.stats.blockedTaskCount === 2, "Product Launch should have two blocked tasks.");
  assert(dependencyMap.stats.blockingTaskCount === 2, "Product Launch should have two blocking tasks.");
  assert(dependencyMap.stats.edgeCount === 2, "Product Launch dependency edge count drifted.");
  assert(dependencyMap.stats.openEdgeCount === 2, "Product Launch open dependency edge count drifted.");
  assert(dependencyMap.stats.readyBlockerCount === 1, "Product Launch should have one ready blocker.");
  const nodesById = new Map(dependencyMap.nodes.map((node) => [node.id, node]));
  const criticalPathTitles = dependencyMap.criticalPathTaskIds.map((taskId) => nodesById.get(taskId)?.title);
  assertList(criticalPathTitles, ["QA signup and invite flow", "Finalize launch checklist", "Draft customer announcement"], "critical path");
}

function expectNamedMember(items: WorkspaceMemberSummary[], email: string, role: string) {
  const member = findRequired(items, (item) => item.user.email === email, email + " workspace member");
  assert(member.role === role, email + " should have workspace role " + role + ".");
}

function expectIncludedNames<T extends { name?: string; title?: string }>(items: T[], expectedNames: string[], label: string) {
  const actualNames = items.map((item) => item.name ?? item.title ?? "").filter(Boolean).sort((left, right) => left.localeCompare(right));
  const missingNames = expectedNames.filter((expectedName) => !actualNames.includes(expectedName));
  assert(missingNames.length === 0, "Expected " + label + " to include " + JSON.stringify(expectedNames) + " but missing " + JSON.stringify(missingNames) + ".");
}

function findRequired<T>(items: T[], predicate: (item: T) => boolean, label: string) {
  const item = items.find(predicate);
  assert(item !== undefined, "Missing " + label + ".");
  return item;
}

function assertList(actual: Array<string | undefined>, expected: string[], label: string) {
  assert(
    actual.length === expected.length && actual.every((item, index) => item === expected[index]),
    "Expected " + label + " to be " + JSON.stringify(expected) + " but received " + JSON.stringify(actual) + ".",
  );
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
