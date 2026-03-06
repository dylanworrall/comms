"use client";

import { useState, useEffect, useCallback } from "react";
import { ContactCard } from "@/components/chat/ContactCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UsersIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  tags: string[];
  lastContacted?: string;
  avatar?: string;
  notes?: string;
  createdAt: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Add form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newTags, setNewTags] = useState("");

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/contacts");
    const data = await res.json();
    setContacts(data.contacts ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const allTags = [...new Set(contacts.flatMap((c) => c.tags))].sort();

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q);
    const matchTag = !tagFilter || c.tags.includes(tagFilter);
    return matchSearch && matchTag;
  });

  const handleAdd = async () => {
    if (!newName.trim() || !newEmail.trim()) return;
    await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        email: newEmail,
        phone: newPhone || undefined,
        company: newCompany || undefined,
        tags: newTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    });
    setNewName("");
    setNewEmail("");
    setNewPhone("");
    setNewCompany("");
    setNewTags("");
    setShowAdd(false);
    fetchContacts();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UsersIcon className="size-6 text-accent" />
          <h1 className="text-xl font-bold">Contacts</h1>
          <Badge variant="secondary" className="text-xs">
            {contacts.length}
          </Badge>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <PlusIcon className="size-3.5" />
          Add Contact
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className="w-full pl-10 pr-3 py-2 bg-surface-1 rounded-lg text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Button
            variant={tagFilter === null ? "default" : "outline"}
            size="sm"
            onClick={() => setTagFilter(null)}
          >
            All
          </Button>
          {allTags.map((tag) => (
            <Button
              key={tag}
              variant={tagFilter === tag ? "default" : "outline"}
              size="sm"
              onClick={() => setTagFilter(tag === tagFilter ? null : tag)}
            >
              {tag}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 rounded-xl shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <UsersIcon className="size-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No contacts found</p>
          <p className="text-sm mt-1">Add contacts or adjust your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((contact) => (
            <ContactCard
              key={contact.id}
              {...contact}
              onClick={(id) =>
                setSelectedContact(contacts.find((c) => c.id === id) ?? null)
              }
            />
          ))}
        </div>
      )}

      {/* Add Contact Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-[450px] bg-surface-1 border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Full name *"
              className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email address *"
              className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Phone number"
              className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <input
              type="text"
              value={newCompany}
              onChange={(e) => setNewCompany(e.target.value)}
              placeholder="Company"
              className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <input
              type="text"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              placeholder="Tags (comma-separated)"
              className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!newName.trim() || !newEmail.trim()}
              >
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact Detail Slide-over */}
      <Dialog
        open={!!selectedContact}
        onOpenChange={(open) => !open && setSelectedContact(null)}
      >
        <DialogContent className="sm:max-w-[450px] bg-surface-1 border-border">
          {selectedContact && (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {selectedContact.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Email: </span>
                    <span className="text-foreground">{selectedContact.email}</span>
                  </div>
                  {selectedContact.phone && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Phone: </span>
                      <span className="text-foreground">{selectedContact.phone}</span>
                    </div>
                  )}
                  {selectedContact.company && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Company: </span>
                      <span className="text-foreground">{selectedContact.company}</span>
                    </div>
                  )}
                  {selectedContact.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {selectedContact.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {selectedContact.notes && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Notes: </span>
                      <span className="text-foreground">{selectedContact.notes}</span>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Added: {new Date(selectedContact.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
