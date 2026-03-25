import { z } from "zod";
import {
  searchContacts,
  getAllContacts,
  getContactById,
  addContact,
  updateContact,
} from "@/lib/stores/contacts";

export const listContactsTool = {
  name: "list_contacts",
  description:
    "List all contacts in the address book. Optionally limit the number of results returned.",
  inputSchema: z.object({
    limit: z
      .number()
      .optional()
      .describe("Maximum number of contacts to return"),
  }),
  execute: async ({ limit }: { limit?: number }) => {
    const contacts = getAllContacts(limit);
    if (contacts.length === 0) {
      return { message: "No contacts found. The address book is empty.", contacts: [] };
    }
    return {
      message: `${contacts.length} contact(s) found`,
      contacts,
    };
  },
};

export const getContactTool = {
  name: "get_contact",
  description: "Get a single contact by their unique ID. Returns full contact details.",
  inputSchema: z.object({
    id: z.string().describe("The contact ID"),
  }),
  execute: async ({ id }: { id: string }) => {
    const contact = getContactById(id);
    if (!contact) {
      return { message: `No contact found with ID "${id}"` };
    }
    return {
      message: `Found contact: ${contact.name}`,
      contact,
    };
  },
};

export const createContactTool = {
  name: "create_contact",
  description:
    "Add a new contact to the address book. Requires name and email at minimum.",
  inputSchema: z.object({
    name: z.string().describe("Full name of the contact"),
    email: z.string().email().describe("Email address"),
    phone: z.string().optional().describe("Phone number"),
    company: z.string().optional().describe("Company or organization name"),
    tags: z
      .array(z.string())
      .default([])
      .describe("Tags for categorization (e.g. client, vendor, friend)"),
    notes: z.string().optional().describe("Freeform notes about this contact"),
  }),
  execute: async (data: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    tags: string[];
    notes?: string;
  }) => {
    const contact = addContact(data);
    return {
      message: `Contact created: ${contact.name} (${contact.email})`,
      contact,
    };
  },
};

export const updateContactTool = {
  name: "update_contact",
  description:
    "Update an existing contact by ID. Only the fields provided will be changed.",
  inputSchema: z.object({
    id: z.string().describe("The contact ID to update"),
    name: z.string().optional().describe("Updated full name"),
    email: z.string().email().optional().describe("Updated email address"),
    phone: z.string().optional().describe("Updated phone number"),
    company: z.string().optional().describe("Updated company name"),
    tags: z.array(z.string()).optional().describe("Updated tags array"),
    notes: z.string().optional().describe("Updated notes"),
  }),
  execute: async ({ id, ...data }: {
    id: string;
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    tags?: string[];
    notes?: string;
  }) => {
    // Filter out undefined values
    const updates = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined)
    );
    if (Object.keys(updates).length === 0) {
      return { message: "No fields provided to update" };
    }
    const contact = updateContact(id, updates);
    if (!contact) {
      return { message: `No contact found with ID "${id}"` };
    }
    return {
      message: `Contact updated: ${contact.name}`,
      contact,
    };
  },
};

export const searchContactsTool = {
  name: "search_contacts",
  description:
    "Search contacts by a query string. Matches against name, email, company, and tags.",
  inputSchema: z.object({
    query: z.string().describe("Search query — name, email, company, or tag"),
  }),
  execute: async ({ query }: { query: string }) => {
    const results = searchContacts(query);
    if (results.length === 0) {
      return { message: `No contacts found for "${query}"`, contacts: [] };
    }
    return {
      message: `Found ${results.length} contact(s) matching "${query}"`,
      contacts: results,
    };
  },
};
