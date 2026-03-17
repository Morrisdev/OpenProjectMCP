#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import {
  dbListProjects, dbUpsertProject, dbDeleteProject,
  dbListUsers,    dbUpsertUser,    dbDeleteUser,
  dbListTypes,    dbUpsertType,    dbDeleteType,
  dbListStatuses, dbUpsertStatus,  dbDeleteStatus,
  dbListFeatures, dbUpsertFeature, dbDeleteFeature,
  rebuildCache,
} from "./db.js";

// Configuration
const OPENPROJECT_BASE_URL = process.env.OPENPROJECT_URL || "https://project.morrisdev.com";
const OPENPROJECT_API_KEY = process.env.OPENPROJECT_API_KEY || "";

// API helper
class OpenProjectAPI {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private getAuthHeader(): string {
    return "Basic " + Buffer.from(`apikey:${this.apiKey}`).toString("base64");
  }

  async request<T>(
    endpoint: string,
    method: string = "GET",
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v3${endpoint}`;
    
    const headers: Record<string, string> = {
      Authorization: this.getAuthHeader(),
      "Content-Type": "application/json",
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && (method === "POST" || method === "PATCH" || method === "PUT")) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenProject API error (${response.status}): ${errorText}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  // Projects
  async listProjects(pageSize: number = 100, offset: number = 1) {
    return this.request(`/projects?pageSize=${pageSize}&offset=${offset}`);
  }

  async getProject(projectId: string | number) {
    return this.request(`/projects/${projectId}`);
  }

  // Work Packages
  async listWorkPackages(
    projectId?: string | number,
    filters?: string,
    pageSize: number = 100,
    offset: number = 1
  ) {
    let endpoint = projectId
      ? `/projects/${projectId}/work_packages`
      : `/work_packages`;
    
    const params = new URLSearchParams();
    params.append("pageSize", pageSize.toString());
    params.append("offset", offset.toString());
    
    if (filters) {
      params.append("filters", filters);
    }
    
    return this.request(`${endpoint}?${params.toString()}`);
  }

  async getWorkPackage(workPackageId: number) {
    return this.request(`/work_packages/${workPackageId}`);
  }

  async createWorkPackage(projectId: string | number, data: WorkPackageCreate) {
    return this.request(`/projects/${projectId}/work_packages`, "POST", data);
  }

  async updateWorkPackage(workPackageId: number, data: WorkPackageUpdate) {
    return this.request(`/work_packages/${workPackageId}`, "PATCH", data);
  }

  async deleteWorkPackage(workPackageId: number) {
    return this.request(`/work_packages/${workPackageId}`, "DELETE");
  }

  // Work Package Activities (Comments)
  async listWorkPackageActivities(workPackageId: number) {
    return this.request(`/work_packages/${workPackageId}/activities`);
  }

  async addWorkPackageComment(workPackageId: number, comment: string) {
    return this.request(`/work_packages/${workPackageId}/activities`, "POST", {
      comment: { raw: comment },
    });
  }

  // Users
  async listUsers(pageSize: number = 100, offset: number = 1) {
    return this.request(`/users?pageSize=${pageSize}&offset=${offset}`);
  }

  async getUser(userId: number) {
    return this.request(`/users/${userId}`);
  }

  async getCurrentUser() {
    return this.request(`/users/me`);
  }

  // Statuses
  async listStatuses() {
    return this.request(`/statuses`);
  }

  // Types
  async listTypes() {
    return this.request(`/types`);
  }

  async listProjectTypes(projectId: string | number) {
    return this.request(`/projects/${projectId}/types`);
  }

  // Priorities
  async listPriorities() {
    return this.request(`/priorities`);
  }

  // Versions
  async listVersions(projectId: string | number) {
    return this.request(`/projects/${projectId}/versions`);
  }

  // Categories
  async listCategories(projectId: string | number) {
    return this.request(`/projects/${projectId}/categories`);
  }

  // Time Entries
  async listTimeEntries(workPackageId?: number, pageSize: number = 100, offset: number = 1) {
    let endpoint = workPackageId
      ? `/work_packages/${workPackageId}/time_entries`
      : `/time_entries`;
    return this.request(`${endpoint}?pageSize=${pageSize}&offset=${offset}`);
  }

  async createTimeEntry(data: TimeEntryCreate) {
    return this.request(`/time_entries`, "POST", data);
  }

  // Relations
  async listWorkPackageRelations(workPackageId: number) {
    return this.request(`/work_packages/${workPackageId}/relations`);
  }

  // Attachments
  async listWorkPackageAttachments(workPackageId: number) {
    return this.request(`/work_packages/${workPackageId}/attachments`);
  }

  // Queries (saved filters)
  async listQueries(projectId?: string | number) {
    const endpoint = projectId ? `/projects/${projectId}/queries` : `/queries`;
    return this.request(endpoint);
  }

  // Search
  async searchWorkPackages(query: string, projectId?: string | number) {
    const filters = JSON.stringify([
      { "subjectOrId": { "operator": "**", "values": [query] } }
    ]);
    return this.listWorkPackages(projectId, filters);
  }
}

// Types
interface WorkPackageCreate {
  subject: string;
  description?: { raw: string };
  _links?: {
    type?: { href: string };
    status?: { href: string };
    priority?: { href: string };
    assignee?: { href: string };
    responsible?: { href: string };
    version?: { href: string };
    parent?: { href: string };
  };
  startDate?: string;
  dueDate?: string;
  estimatedTime?: string;
  customField1?: string;
}

interface WorkPackageUpdate {
  subject?: string;
  description?: { raw: string };
  _links?: {
    type?: { href: string };
    status?: { href: string };
    priority?: { href: string };
    assignee?: { href: string };
    responsible?: { href: string };
    version?: { href: string };
    parent?: { href: string };
  };
  startDate?: string;
  dueDate?: string;
  estimatedTime?: string;
  percentageDone?: number;
  lockVersion?: number;
  customField1?: string;
}

interface TimeEntryCreate {
  _links: {
    project: { href: string };
    workPackage?: { href: string };
    activity: { href: string };
  };
  hours: string;
  comment?: { raw: string };
  spentOn: string;
}

// Tool definitions
const tools: Tool[] = [
  {
    name: "get_cached_projects",
    description: "Get the cached project directory (no API call). Returns all project IDs, identifiers, names, active status, and parent relationships. Use this instead of list_projects when you just need to look up a project ID by name.",
    inputSchema: {
      type: "object",
      properties: {
        activeOnly: {
          type: "boolean",
          description: "If true, only return active projects (default: false)",
        },
      },
    },
  },
  {
    name: "get_cached_users",
    description: "Get the cached user directory (no API call). Returns all user IDs, names, emails, logins, and status. Use this instead of list_users when you just need to look up a user ID by name.",
    inputSchema: {
      type: "object",
      properties: {
        activeOnly: {
          type: "boolean",
          description: "If true, only return active users (default: false)",
        },
      },
    },
  },
  {
    name: "get_cached_types",
    description: "Get the cached work package types (no API call). Returns type IDs and names (Task, Bug, Feature, Milestone, etc.). Use this instead of list_types when you just need to look up a type ID by name.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_cached_statuses",
    description: "Get the cached work package statuses (no API call). Returns status IDs, names, and whether they represent a closed state. Use this instead of list_statuses when you just need to look up a status ID by name.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_cached_features",
    description: "Get the cached list of open Feature work packages (no API call). Returns feature IDs, subjects, projectId, project name, module (customField1), and status. When a feature is chosen as a parent for a new work package, set the module (customField1) to the feature's module value. Use this to offer feature options when creating work packages.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "number",
          description: "Filter by project ID (optional)",
        },
      },
    },
  },
  {
    name: "rebuild_cache",
    description: "Rebuild the entire local cache by fetching fresh data from OpenProject API. Updates projects, users, types, statuses, and open features.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "cache_upsert_project",
    description: "Add or update a project in the local cache.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Project ID" },
        identifier: { type: "string", description: "URL identifier" },
        name: { type: "string", description: "Display name" },
        active: { type: "boolean", description: "Is active (default: true)" },
        parent: { type: "string", description: "Parent project name (optional)" },
      },
      required: ["id", "identifier", "name"],
    },
  },
  {
    name: "cache_delete_project",
    description: "Remove a project from the local cache.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number", description: "Project ID" } },
      required: ["id"],
    },
  },
  {
    name: "cache_upsert_user",
    description: "Add or update a user in the local cache.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "User ID" },
        login: { type: "string", description: "Login/username" },
        name: { type: "string", description: "Display name" },
        email: { type: "string", description: "Email address" },
        status: { type: "string", description: "Status (active, locked, invited)" },
      },
      required: ["id", "login", "name", "email", "status"],
    },
  },
  {
    name: "cache_delete_user",
    description: "Remove a user from the local cache.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number", description: "User ID" } },
      required: ["id"],
    },
  },
  {
    name: "cache_upsert_type",
    description: "Add or update a work package type in the local cache.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Type ID" },
        name: { type: "string", description: "Type name" },
        isDefault: { type: "boolean", description: "Is default type" },
        isMilestone: { type: "boolean", description: "Is milestone type" },
      },
      required: ["id", "name"],
    },
  },
  {
    name: "cache_delete_type",
    description: "Remove a work package type from the local cache.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number", description: "Type ID" } },
      required: ["id"],
    },
  },
  {
    name: "cache_upsert_status",
    description: "Add or update a work package status in the local cache.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Status ID" },
        name: { type: "string", description: "Status name" },
        isClosed: { type: "boolean", description: "Is a closed state" },
        isDefault: { type: "boolean", description: "Is the default status" },
      },
      required: ["id", "name"],
    },
  },
  {
    name: "cache_delete_status",
    description: "Remove a work package status from the local cache.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number", description: "Status ID" } },
      required: ["id"],
    },
  },
  {
    name: "cache_upsert_feature",
    description: "Add or update a feature in the local cache.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Work package ID" },
        subject: { type: "string", description: "Feature title" },
        projectId: { type: "number", description: "Project ID" },
        project: { type: "string", description: "Project name" },
        module: { type: "string", description: "Module (customField1)" },
        status: { type: "string", description: "Current status" },
      },
      required: ["id", "subject", "projectId", "project", "status"],
    },
  },
  {
    name: "cache_delete_feature",
    description: "Remove a feature from the local cache.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number", description: "Feature work package ID" } },
      required: ["id"],
    },
  },
  {
    name: "list_projects",
    description: "List all projects from the OpenProject API (live data). Prefer get_cached_projects for simple ID lookups.",
    inputSchema: {
      type: "object",
      properties: {
        pageSize: {
          type: "number",
          description: "Number of results per page (default: 100)",
        },
        offset: {
          type: "number",
          description: "Page offset (default: 1)",
        },
      },
    },
  },
  {
    name: "get_project",
    description: "Get details of a specific project",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "Project ID or identifier",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "list_work_packages",
    description: "List work packages (tasks, bugs, features, etc.) in OpenProject",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "Project ID or identifier (optional, lists all if not provided)",
        },
        filters: {
          type: "string",
          description: "JSON array of filter objects (OpenProject filter format)",
        },
        pageSize: {
          type: "number",
          description: "Number of results per page (default: 100)",
        },
        offset: {
          type: "number",
          description: "Page offset (default: 1)",
        },
      },
    },
  },
  {
    name: "get_work_package",
    description: "Get details of a specific work package",
    inputSchema: {
      type: "object",
      properties: {
        workPackageId: {
          type: "number",
          description: "Work package ID",
        },
      },
      required: ["workPackageId"],
    },
  },
  {
    name: "create_work_package",
    description: "Create a new work package in a project",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "Project ID or identifier",
        },
        subject: {
          type: "string",
          description: "Title/subject of the work package",
        },
        description: {
          type: "string",
          description: "Description of the work package",
        },
        typeId: {
          type: "number",
          description: "Type ID (e.g., Task, Bug, Feature)",
        },
        statusId: {
          type: "number",
          description: "Status ID",
        },
        priorityId: {
          type: "number",
          description: "Priority ID",
        },
        assigneeId: {
          type: "number",
          description: "User ID to assign the work package to",
        },
        responsibleId: {
          type: "number",
          description: "User ID responsible for the work package",
        },
        versionId: {
          type: "number",
          description: "Version/milestone ID",
        },
        parentId: {
          type: "number",
          description: "Parent work package ID",
        },
        startDate: {
          type: "string",
          description: "Start date (YYYY-MM-DD)",
        },
        dueDate: {
          type: "string",
          description: "Due date (YYYY-MM-DD)",
        },
        estimatedTime: {
          type: "string",
          description: "Estimated time (ISO 8601 duration, e.g., PT2H for 2 hours)",
        },
        module: {
          type: "string",
          description: "Module name (customField1). When a feature is chosen as parent, set this to the feature's module value.",
        },
      },
      required: ["projectId", "subject"],
    },
  },
  {
    name: "update_work_package",
    description: "Update an existing work package",
    inputSchema: {
      type: "object",
      properties: {
        workPackageId: {
          type: "number",
          description: "Work package ID to update",
        },
        subject: {
          type: "string",
          description: "New title/subject",
        },
        description: {
          type: "string",
          description: "New description",
        },
        typeId: {
          type: "number",
          description: "New type ID",
        },
        statusId: {
          type: "number",
          description: "New status ID",
        },
        priorityId: {
          type: "number",
          description: "New priority ID",
        },
        assigneeId: {
          type: "number",
          description: "New assignee user ID",
        },
        responsibleId: {
          type: "number",
          description: "New responsible user ID",
        },
        versionId: {
          type: "number",
          description: "New version/milestone ID",
        },
        parentId: {
          type: "number",
          description: "New parent work package ID",
        },
        startDate: {
          type: "string",
          description: "New start date (YYYY-MM-DD)",
        },
        dueDate: {
          type: "string",
          description: "New due date (YYYY-MM-DD)",
        },
        estimatedTime: {
          type: "string",
          description: "New estimated time (ISO 8601 duration)",
        },
        percentageDone: {
          type: "number",
          description: "Percentage complete (0-100)",
        },
        module: {
          type: "string",
          description: "Module name (customField1)",
        },
      },
      required: ["workPackageId"],
    },
  },
  {
    name: "delete_work_package",
    description: "Delete a work package",
    inputSchema: {
      type: "object",
      properties: {
        workPackageId: {
          type: "number",
          description: "Work package ID to delete",
        },
      },
      required: ["workPackageId"],
    },
  },
  {
    name: "search_work_packages",
    description: "Search for work packages by subject or ID",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (searches in subject and ID)",
        },
        projectId: {
          type: "string",
          description: "Limit search to a specific project (optional)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_work_package_activities",
    description: "List activities (comments, changes) on a work package",
    inputSchema: {
      type: "object",
      properties: {
        workPackageId: {
          type: "number",
          description: "Work package ID",
        },
      },
      required: ["workPackageId"],
    },
  },
  {
    name: "add_work_package_comment",
    description: "Add a comment to a work package",
    inputSchema: {
      type: "object",
      properties: {
        workPackageId: {
          type: "number",
          description: "Work package ID",
        },
        comment: {
          type: "string",
          description: "Comment text",
        },
      },
      required: ["workPackageId", "comment"],
    },
  },
  {
    name: "list_users",
    description: "List all users in OpenProject",
    inputSchema: {
      type: "object",
      properties: {
        pageSize: {
          type: "number",
          description: "Number of results per page (default: 100)",
        },
        offset: {
          type: "number",
          description: "Page offset (default: 1)",
        },
      },
    },
  },
  {
    name: "get_user",
    description: "Get details of a specific user",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "number",
          description: "User ID",
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "get_current_user",
    description: "Get details of the currently authenticated user",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_statuses",
    description: "List all work package statuses from the API (live data). Prefer get_cached_statuses for simple ID lookups.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_types",
    description: "List all work package types from the API (live data). Prefer get_cached_types for simple ID lookups.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_project_types",
    description: "List work package types available in a specific project",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "Project ID or identifier",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "list_priorities",
    description: "List all work package priorities",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_versions",
    description: "List versions/milestones in a project",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "Project ID or identifier",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "list_categories",
    description: "List categories in a project",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "Project ID or identifier",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "list_time_entries",
    description: "List time entries",
    inputSchema: {
      type: "object",
      properties: {
        workPackageId: {
          type: "number",
          description: "Filter by work package ID (optional)",
        },
        pageSize: {
          type: "number",
          description: "Number of results per page (default: 100)",
        },
        offset: {
          type: "number",
          description: "Page offset (default: 1)",
        },
      },
    },
  },
  {
    name: "create_time_entry",
    description: "Log time against a work package",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "Project ID or identifier",
        },
        workPackageId: {
          type: "number",
          description: "Work package ID (optional)",
        },
        activityId: {
          type: "number",
          description: "Time entry activity ID",
        },
        hours: {
          type: "string",
          description: "Hours spent (ISO 8601 duration, e.g., PT2H30M)",
        },
        comment: {
          type: "string",
          description: "Comment for the time entry",
        },
        spentOn: {
          type: "string",
          description: "Date the time was spent (YYYY-MM-DD)",
        },
      },
      required: ["projectId", "activityId", "hours", "spentOn"],
    },
  },
  {
    name: "list_work_package_relations",
    description: "List relations (blocks, follows, etc.) for a work package",
    inputSchema: {
      type: "object",
      properties: {
        workPackageId: {
          type: "number",
          description: "Work package ID",
        },
      },
      required: ["workPackageId"],
    },
  },
  {
    name: "list_work_package_attachments",
    description: "List attachments on a work package",
    inputSchema: {
      type: "object",
      properties: {
        workPackageId: {
          type: "number",
          description: "Work package ID",
        },
      },
      required: ["workPackageId"],
    },
  },
  {
    name: "list_queries",
    description: "List saved queries/filters",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "Project ID or identifier (optional)",
        },
      },
    },
  },
];

// Main server setup
const server = new Server(
  {
    name: "openproject-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const api = new OpenProjectAPI(OPENPROJECT_BASE_URL, OPENPROJECT_API_KEY);

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case "get_cached_projects":
        result = dbListProjects(args?.activeOnly as boolean | undefined);
        break;

      case "get_cached_users":
        result = dbListUsers(args?.activeOnly as boolean | undefined);
        break;

      case "get_cached_features":
        result = dbListFeatures(args?.projectId as number | undefined);
        break;

      case "get_cached_types":
        result = dbListTypes();
        break;

      case "get_cached_statuses":
        result = dbListStatuses();
        break;

      // ── Cache management ──────────────────────────────────────────────────

      case "cache_upsert_project":
        dbUpsertProject(
          args?.id as number,
          args?.identifier as string,
          args?.name as string,
          args?.active as boolean ?? true,
          args?.parent as string | null ?? null
        );
        result = { success: true };
        break;

      case "cache_delete_project":
        dbDeleteProject(args?.id as number);
        result = { success: true };
        break;

      case "cache_upsert_user":
        dbUpsertUser(
          args?.id as number,
          args?.login as string,
          args?.name as string,
          args?.email as string,
          args?.status as string
        );
        result = { success: true };
        break;

      case "cache_delete_user":
        dbDeleteUser(args?.id as number);
        result = { success: true };
        break;

      case "cache_upsert_type":
        dbUpsertType(
          args?.id as number,
          args?.name as string,
          args?.isDefault as boolean ?? false,
          args?.isMilestone as boolean ?? false
        );
        result = { success: true };
        break;

      case "cache_delete_type":
        dbDeleteType(args?.id as number);
        result = { success: true };
        break;

      case "cache_upsert_status":
        dbUpsertStatus(
          args?.id as number,
          args?.name as string,
          args?.isClosed as boolean ?? false,
          args?.isDefault as boolean ?? false
        );
        result = { success: true };
        break;

      case "cache_delete_status":
        dbDeleteStatus(args?.id as number);
        result = { success: true };
        break;

      case "cache_upsert_feature":
        dbUpsertFeature(
          args?.id as number,
          args?.subject as string,
          args?.projectId as number,
          args?.project as string,
          args?.module as string ?? "",
          args?.status as string
        );
        result = { success: true };
        break;

      case "cache_delete_feature":
        dbDeleteFeature(args?.id as number);
        result = { success: true };
        break;

      case "rebuild_cache":
        result = await rebuildCache(OPENPROJECT_BASE_URL, OPENPROJECT_API_KEY);
        break;

      case "list_projects":
        result = await api.listProjects(
          args?.pageSize as number,
          args?.offset as number
        );
        break;

      case "get_project":
        result = await api.getProject(args?.projectId as string);
        break;

      case "list_work_packages":
        result = await api.listWorkPackages(
          args?.projectId as string,
          args?.filters as string,
          args?.pageSize as number,
          args?.offset as number
        );
        break;

      case "get_work_package":
        result = await api.getWorkPackage(args?.workPackageId as number);
        break;

      case "create_work_package": {
        const createData: WorkPackageCreate = {
          subject: args?.subject as string,
        };
        
        if (args?.description) {
          createData.description = { raw: args.description as string };
        }
        
        createData._links = {};
        if (args?.typeId) {
          createData._links.type = { href: `/api/v3/types/${args.typeId}` };
        }
        if (args?.statusId) {
          createData._links.status = { href: `/api/v3/statuses/${args.statusId}` };
        }
        if (args?.priorityId) {
          createData._links.priority = { href: `/api/v3/priorities/${args.priorityId}` };
        }
        if (args?.assigneeId) {
          createData._links.assignee = { href: `/api/v3/users/${args.assigneeId}` };
        }
        if (args?.responsibleId) {
          createData._links.responsible = { href: `/api/v3/users/${args.responsibleId}` };
        }
        if (args?.versionId) {
          createData._links.version = { href: `/api/v3/versions/${args.versionId}` };
        }
        if (args?.parentId) {
          createData._links.parent = { href: `/api/v3/work_packages/${args.parentId}` };
        }
        
        if (args?.startDate) createData.startDate = args.startDate as string;
        if (args?.dueDate) createData.dueDate = args.dueDate as string;
        if (args?.estimatedTime) createData.estimatedTime = args.estimatedTime as string;
        if (args?.module) createData.customField1 = args.module as string;

        result = await api.createWorkPackage(args?.projectId as string, createData);
        break;
      }

      case "update_work_package": {
        // First get the current work package to get the lockVersion
        const current = await api.getWorkPackage(args?.workPackageId as number) as { lockVersion: number };
        
        const updateData: WorkPackageUpdate = {
          lockVersion: current.lockVersion,
        };
        
        if (args?.subject) updateData.subject = args.subject as string;
        if (args?.description) {
          updateData.description = { raw: args.description as string };
        }
        
        updateData._links = {};
        if (args?.typeId) {
          updateData._links.type = { href: `/api/v3/types/${args.typeId}` };
        }
        if (args?.statusId) {
          updateData._links.status = { href: `/api/v3/statuses/${args.statusId}` };
        }
        if (args?.priorityId) {
          updateData._links.priority = { href: `/api/v3/priorities/${args.priorityId}` };
        }
        if (args?.assigneeId) {
          updateData._links.assignee = { href: `/api/v3/users/${args.assigneeId}` };
        }
        if (args?.responsibleId) {
          updateData._links.responsible = { href: `/api/v3/users/${args.responsibleId}` };
        }
        if (args?.versionId) {
          updateData._links.version = { href: `/api/v3/versions/${args.versionId}` };
        }
        if (args?.parentId) {
          updateData._links.parent = { href: `/api/v3/work_packages/${args.parentId}` };
        }
        
        if (args?.startDate) updateData.startDate = args.startDate as string;
        if (args?.dueDate) updateData.dueDate = args.dueDate as string;
        if (args?.estimatedTime) updateData.estimatedTime = args.estimatedTime as string;
        if (args?.percentageDone !== undefined) updateData.percentageDone = args.percentageDone as number;
        if (args?.module) updateData.customField1 = args.module as string;
        
        result = await api.updateWorkPackage(args?.workPackageId as number, updateData);
        break;
      }

      case "delete_work_package":
        result = await api.deleteWorkPackage(args?.workPackageId as number);
        break;

      case "search_work_packages":
        result = await api.searchWorkPackages(
          args?.query as string,
          args?.projectId as string
        );
        break;

      case "list_work_package_activities":
        result = await api.listWorkPackageActivities(args?.workPackageId as number);
        break;

      case "add_work_package_comment":
        result = await api.addWorkPackageComment(
          args?.workPackageId as number,
          args?.comment as string
        );
        break;

      case "list_users":
        result = await api.listUsers(
          args?.pageSize as number,
          args?.offset as number
        );
        break;

      case "get_user":
        result = await api.getUser(args?.userId as number);
        break;

      case "get_current_user":
        result = await api.getCurrentUser();
        break;

      case "list_statuses":
        result = await api.listStatuses();
        break;

      case "list_types":
        result = await api.listTypes();
        break;

      case "list_project_types":
        result = await api.listProjectTypes(args?.projectId as string);
        break;

      case "list_priorities":
        result = await api.listPriorities();
        break;

      case "list_versions":
        result = await api.listVersions(args?.projectId as string);
        break;

      case "list_categories":
        result = await api.listCategories(args?.projectId as string);
        break;

      case "list_time_entries":
        result = await api.listTimeEntries(
          args?.workPackageId as number,
          args?.pageSize as number,
          args?.offset as number
        );
        break;

      case "create_time_entry": {
        const timeData: TimeEntryCreate = {
          _links: {
            project: { href: `/api/v3/projects/${args?.projectId}` },
            activity: { href: `/api/v3/time_entries/activities/${args?.activityId}` },
          },
          hours: args?.hours as string,
          spentOn: args?.spentOn as string,
        };
        
        if (args?.workPackageId) {
          timeData._links.workPackage = { href: `/api/v3/work_packages/${args.workPackageId}` };
        }
        if (args?.comment) {
          timeData.comment = { raw: args.comment as string };
        }
        
        result = await api.createTimeEntry(timeData);
        break;
      }

      case "list_work_package_relations":
        result = await api.listWorkPackageRelations(args?.workPackageId as number);
        break;

      case "list_work_package_attachments":
        result = await api.listWorkPackageAttachments(args?.workPackageId as number);
        break;

      case "list_queries":
        result = await api.listQueries(args?.projectId as string);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("OpenProject MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
