import { z } from "zod";
import { getApprovals, resolveApproval } from "@/lib/stores/approvals";

export const listPendingApprovalsTool = {
  name: "list_pending_approvals",
  description:
    "List approval items from the queue. Defaults to pending items, but can filter by status.",
  inputSchema: z.object({
    status: z
      .enum(["pending", "approved", "rejected"])
      .default("pending")
      .describe("Filter by approval status (default: pending)"),
  }),
  execute: async ({ status }: { status: "pending" | "approved" | "rejected" }) => {
    const items = getApprovals(status);
    if (items.length === 0) {
      return {
        message: `No ${status} approvals found.`,
        approvals: [],
      };
    }
    return {
      message: `${items.length} ${status} approval(s)`,
      approvals: items,
    };
  },
};

export const approveActionTool = {
  name: "approve_action",
  description:
    "Approve a pending approval item by its ID. This will mark the action as approved and allow it to proceed (e.g., sending an email, placing a call).",
  inputSchema: z.object({
    id: z.string().describe("The approval item ID to approve"),
  }),
  execute: async ({ id }: { id: string }) => {
    const result = resolveApproval(id, "approved");
    if (!result) {
      return {
        message: `Approval "${id}" not found or has already been resolved.`,
      };
    }
    return {
      message: `Approved: ${result.type} (ID: ${result.id})`,
      approval: result,
    };
  },
};

export const denyActionTool = {
  name: "deny_action",
  description:
    "Deny/reject a pending approval item by its ID. The associated action will NOT be executed.",
  inputSchema: z.object({
    id: z.string().describe("The approval item ID to deny"),
  }),
  execute: async ({ id }: { id: string }) => {
    const result = resolveApproval(id, "rejected");
    if (!result) {
      return {
        message: `Approval "${id}" not found or has already been resolved.`,
      };
    }
    return {
      message: `Denied: ${result.type} (ID: ${result.id})`,
      approval: result,
    };
  },
};
