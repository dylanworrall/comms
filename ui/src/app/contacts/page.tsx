"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  UsersIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
  PhoneIcon,
  MessageCircleIcon,
  MailIcon,
  PencilIcon,
  TrashIcon,
  SaveIcon,
  FlameIcon,
  ClockIcon,
  CalendarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  MessageSquareIcon,
  PhoneCallIcon,
  MailOpenIcon,
  StickyNoteIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContactStatus = "lead" | "active" | "warm" | "cold" | "closed";

interface TouchPoint {
  type: string;
  summary: string;
  timestamp: string;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  tags: string[];
  notes?: string;
  lastContacted?: string;
  createdAt: string;
  status?: ContactStatus;
  priority?: number;
  nextFollowUp?: string;
  touchPoints?: TouchPoint[];
  dealValue?: number;
  source?: string;
}

type SortBy = "name" | "priority" | "lastContacted" | "nextFollowUp";
type ViewMode = "all" | "follow-ups" | "hot" | "cold";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).filter(Boolean).join("").toUpperCase().slice(0, 2);
}

function getAvatarColor(name: string) {
  const colors = [
    "bg-[#0A84FF]/15 text-[#0A84FF]",
    "bg-[#BF5AF2]/15 text-[#BF5AF2]",
    "bg-[#30D158]/15 text-[#30D158]",
    "bg-[#FF9F0A]/15 text-[#FF9F0A]",
    "bg-[#FF453A]/15 text-[#FF453A]",
    "bg-[#5E5CE6]/15 text-[#5E5CE6]",
  ];
  let hash = 0;
  for (const char of name) hash = char.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

const STATUS_CONFIG: Record<ContactStatus, { label: string; color: string }> = {
  lead: { label: "Lead", color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  active: { label: "Active", color: "bg-green-500/15 text-green-400 border-green-500/20" },
  warm: { label: "Warm", color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  cold: { label: "Cold", color: "bg-slate-500/15 text-slate-400 border-slate-500/20" },
  closed: { label: "Closed", color: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
};

const TOUCH_ICONS: Record<string, React.ElementType> = {
  email_sent: MailIcon,
  email_received: MailOpenIcon,
  call: PhoneCallIcon,
  sms_sent: MessageCircleIcon,
  sms_received: MessageSquareIcon,
  meeting: CalendarIcon,
  note: StickyNoteIcon,
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ContactStatus | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [sortBy, setSortBy] = useState<SortBy>("priority");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(false);

  // Form state
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", tags: "", notes: "", status: "lead" as ContactStatus, priority: 3, source: "", dealValue: "", nextFollowUp: "" });

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/contacts");
    const data = await res.json();
    setContacts(data.contacts ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const allTags = useMemo(() => [...new Set(contacts.flatMap((c) => c.tags))].sort(), [contacts]);

  const filtered = useMemo(() => {
    let result = [...contacts];

    // View mode filters
    if (viewMode === "follow-ups") {
      result = result.filter((c) => c.nextFollowUp && daysUntil(c.nextFollowUp) <= 7);
    } else if (viewMode === "hot") {
      result = result.filter((c) => (c.priority ?? 0) >= 4);
    } else if (viewMode === "cold") {
      const thirtyDaysAgo = Date.now() - 30 * 86400000;
      result = result.filter((c) => !c.lastContacted || new Date(c.lastContacted).getTime() < thirtyDaysAgo);
    }

    // Status filter
    if (statusFilter) result = result.filter((c) => c.status === statusFilter);

    // Tag filter
    if (tagFilter) result = result.filter((c) => c.tags.includes(tagFilter));

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.source?.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "priority") return (b.priority ?? 0) - (a.priority ?? 0);
      if (sortBy === "lastContacted") {
        if (!a.lastContacted) return 1;
        if (!b.lastContacted) return -1;
        return new Date(b.lastContacted).getTime() - new Date(a.lastContacted).getTime();
      }
      if (sortBy === "nextFollowUp") {
        if (!a.nextFollowUp) return 1;
        if (!b.nextFollowUp) return -1;
        return new Date(a.nextFollowUp).getTime() - new Date(b.nextFollowUp).getTime();
      }
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [contacts, search, tagFilter, statusFilter, viewMode, sortBy]);

  // Stats
  const stats = useMemo(() => {
    const followUps = contacts.filter((c) => c.nextFollowUp && daysUntil(c.nextFollowUp) <= 7).length;
    const hot = contacts.filter((c) => (c.priority ?? 0) >= 4).length;
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    const cold = contacts.filter((c) => !c.lastContacted || new Date(c.lastContacted).getTime() < thirtyDaysAgo).length;
    return { followUps, hot, cold, total: contacts.length };
  }, [contacts]);

  const resetForm = () => setForm({ name: "", email: "", phone: "", company: "", tags: "", notes: "", status: "lead", priority: 3, source: "", dealValue: "", nextFollowUp: "" });

  const handleAdd = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name, email: form.email,
        phone: form.phone || undefined, company: form.company || undefined,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        notes: form.notes || undefined, status: form.status, priority: form.priority,
        source: form.source || undefined,
        dealValue: form.dealValue ? Number(form.dealValue) : undefined,
        nextFollowUp: form.nextFollowUp || undefined,
      }),
    });
    resetForm();
    setShowAdd(false);
    fetchContacts();
  };

  const handleSave = async () => {
    if (!selectedContact) return;
    await fetch("/api/contacts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selectedContact.id, name: form.name, email: form.email,
        phone: form.phone || undefined, company: form.company || undefined,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        notes: form.notes || undefined, status: form.status, priority: form.priority,
        source: form.source || undefined,
        dealValue: form.dealValue ? Number(form.dealValue) : undefined,
        nextFollowUp: form.nextFollowUp || undefined,
      }),
    });
    setEditing(false);
    fetchContacts();
    const res = await fetch("/api/contacts");
    const data = await res.json();
    setSelectedContact(data.contacts?.find((c: Contact) => c.id === selectedContact.id) ?? null);
  };

  const handleDelete = async () => {
    if (!selectedContact) return;
    await fetch("/api/contacts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selectedContact.id }) });
    setSelectedContact(null);
    fetchContacts();
  };

  const openEdit = () => {
    if (!selectedContact) return;
    setForm({
      name: selectedContact.name, email: selectedContact.email,
      phone: selectedContact.phone || "", company: selectedContact.company || "",
      tags: selectedContact.tags.join(", "), notes: selectedContact.notes || "",
      status: selectedContact.status || "lead", priority: selectedContact.priority ?? 3,
      source: selectedContact.source || "",
      dealValue: selectedContact.dealValue?.toString() || "",
      nextFollowUp: selectedContact.nextFollowUp?.slice(0, 10) || "",
    });
    setEditing(true);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <UsersIcon className="size-6 text-accent" />
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Contacts</h1>
          <Badge variant="secondary" className="text-xs bg-surface-2/60 text-foreground/40 border-0">{contacts.length}</Badge>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }} className="bg-accent hover:bg-accent/90 text-foreground rounded-xl">
          <PlusIcon className="size-3.5" /> Add
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Follow-ups due", value: stats.followUps, icon: ClockIcon, color: "text-amber-400", mode: "follow-ups" as ViewMode },
          { label: "Hot leads", value: stats.hot, icon: FlameIcon, color: "text-orange-400", mode: "hot" as ViewMode },
          { label: "Gone cold", value: stats.cold, icon: ArrowDownIcon, color: "text-slate-400", mode: "cold" as ViewMode },
          { label: "Total", value: stats.total, icon: UsersIcon, color: "text-accent", mode: "all" as ViewMode },
        ].map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setViewMode(viewMode === s.mode ? "all" : s.mode)}
            className={cn(
              "p-3 rounded-xl border text-left transition-all cursor-pointer",
              viewMode === s.mode ? "bg-accent/5 border-accent/20" : "bg-surface-1 border-border hover:border-foreground/10"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={cn("size-3.5", s.color)} />
              <span className="text-[11px] text-muted-foreground">{s.label}</span>
            </div>
            <div className="text-lg font-bold text-foreground">{s.value}</div>
          </button>
        ))}
      </div>

      {/* Search + Sort + Status Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground/25" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contacts..."
            className="w-full pl-10 pr-3 py-2.5 bg-surface-2/40 rounded-xl text-sm text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-accent/30 placeholder:text-foreground/20 transition-all" />
        </div>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="bg-surface-2/40 rounded-xl px-3 py-2.5 text-sm text-foreground border border-border cursor-pointer focus:outline-none">
          <option value="priority">Priority</option>
          <option value="lastContacted">Last Contact</option>
          <option value="nextFollowUp">Next Follow-up</option>
          <option value="name">Name</option>
        </select>
      </div>

      {/* Status pills */}
      <div className="flex gap-1.5 flex-wrap mb-5">
        <button onClick={() => setStatusFilter(null)} className={cn("px-2.5 py-1 rounded-lg text-xs border transition-colors cursor-pointer", !statusFilter ? "bg-accent/15 border-accent/30 text-accent" : "bg-surface-2 border-border text-muted-foreground hover:text-foreground")}>All</button>
        {(Object.keys(STATUS_CONFIG) as ContactStatus[]).map((s) => (
          <button key={s} onClick={() => setStatusFilter(statusFilter === s ? null : s)}
            className={cn("px-2.5 py-1 rounded-lg text-xs border transition-colors cursor-pointer", statusFilter === s ? STATUS_CONFIG[s].color : "bg-surface-2 border-border text-muted-foreground hover:text-foreground")}>
            {STATUS_CONFIG[s].label}
          </button>
        ))}
        {allTags.length > 0 && <div className="w-px h-6 bg-border mx-1 self-center" />}
        {allTags.map((tag) => (
          <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
            className={cn("px-2.5 py-1 rounded-lg text-xs border transition-colors cursor-pointer", tagFilter === tag ? "bg-accent/15 border-accent/30 text-accent" : "bg-surface-2 border-border text-muted-foreground hover:text-foreground")}>
            {tag}
          </button>
        ))}
      </div>

      {/* Contact List */}
      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map((i) => <div key={i} className="h-20 rounded-xl shimmer" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <UsersIcon className="size-12 mx-auto mb-4 text-foreground/15" />
          <p className="text-lg text-foreground/40">No contacts found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const priorityDots = c.priority ?? 0;
            const followUpDays = c.nextFollowUp ? daysUntil(c.nextFollowUp) : null;
            const overdue = followUpDays !== null && followUpDays < 0;
            const dueSoon = followUpDays !== null && followUpDays >= 0 && followUpDays <= 3;

            return (
              <div
                key={c.id}
                onClick={() => setSelectedContact(c)}
                className={cn(
                  "flex items-center gap-4 px-4 py-3.5 rounded-xl bg-surface-1 border border-border hover:border-foreground/15 transition-all cursor-pointer",
                  overdue && "border-l-2 border-l-destructive",
                  dueSoon && !overdue && "border-l-2 border-l-amber-400"
                )}
              >
                {/* Avatar */}
                <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center font-semibold text-sm flex-shrink-0", getAvatarColor(c.name))}>
                  {getInitials(c.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{c.name}</span>
                    {c.status && <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md border", STATUS_CONFIG[c.status].color)}>{STATUS_CONFIG[c.status].label}</span>}
                    {c.dealValue && <span className="text-[10px] text-green-400 font-medium">${c.dealValue.toLocaleString()}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {c.company ? `${c.company} · ` : ""}{c.email}
                  </div>
                </div>

                {/* Priority dots */}
                <div className="flex gap-0.5 shrink-0">
                  {[1,2,3,4,5].map((i) => (
                    <div key={i} className={cn("w-1.5 h-1.5 rounded-full", i <= priorityDots ? "bg-accent" : "bg-surface-2")} />
                  ))}
                </div>

                {/* Last contacted */}
                <div className="text-right shrink-0 w-20">
                  {c.lastContacted ? (
                    <div className="text-[11px] text-muted-foreground">{relativeTime(c.lastContacted)}</div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground/40">Never</div>
                  )}
                  {c.nextFollowUp && (
                    <div className={cn("text-[10px] font-medium", overdue ? "text-destructive" : dueSoon ? "text-amber-400" : "text-muted-foreground/50")}>
                      {overdue ? `${Math.abs(followUpDays!)}d overdue` : followUpDays === 0 ? "Today" : `in ${followUpDays}d`}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Contact Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-[500px] bg-surface-1 border-border">
          <DialogHeader><DialogTitle className="text-foreground">Add Contact</DialogTitle></DialogHeader>
          <ContactForm form={form} setForm={setForm} onSubmit={handleAdd} submitLabel="Add Contact" />
        </DialogContent>
      </Dialog>

      {/* Contact Detail Dialog */}
      <Dialog open={!!selectedContact} onOpenChange={(open) => { if (!open) { setSelectedContact(null); setEditing(false); } }}>
        <DialogContent className="sm:max-w-[550px] bg-surface-1 border-border max-h-[85vh] overflow-y-auto">
          {selectedContact && !editing && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-foreground">{selectedContact.name}</DialogTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={openEdit}><PencilIcon className="size-3.5" /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={handleDelete} className="text-destructive"><TrashIcon className="size-3.5" /></Button>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {/* Quick actions */}
                <div className="flex gap-2">
                  {selectedContact.phone && (
                    <>
                      <a href={`tel:${selectedContact.phone}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium hover:bg-green-500/15 transition-colors">
                        <PhoneIcon className="size-3" /> Call
                      </a>
                      <button onClick={() => router.push(`/sms?phone=${encodeURIComponent(selectedContact.phone!)}`)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/15 transition-colors cursor-pointer">
                        <MessageCircleIcon className="size-3" /> Text
                      </button>
                    </>
                  )}
                  <a href={`mailto:${selectedContact.email}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/15 transition-colors">
                    <MailIcon className="size-3" /> Email
                  </a>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground/60 text-xs">Email</span><div className="text-foreground/80 truncate">{selectedContact.email}</div></div>
                  {selectedContact.phone && <div><span className="text-muted-foreground/60 text-xs">Phone</span><div className="text-foreground/80">{selectedContact.phone}</div></div>}
                  {selectedContact.company && <div><span className="text-muted-foreground/60 text-xs">Company</span><div className="text-foreground/80">{selectedContact.company}</div></div>}
                  {selectedContact.source && <div><span className="text-muted-foreground/60 text-xs">Source</span><div className="text-foreground/80">{selectedContact.source}</div></div>}
                  {selectedContact.status && <div><span className="text-muted-foreground/60 text-xs">Status</span><div><span className={cn("text-xs px-1.5 py-0.5 rounded-md border", STATUS_CONFIG[selectedContact.status].color)}>{STATUS_CONFIG[selectedContact.status].label}</span></div></div>}
                  {selectedContact.dealValue && <div><span className="text-muted-foreground/60 text-xs">Deal Value</span><div className="text-green-400 font-medium">${selectedContact.dealValue.toLocaleString()}</div></div>}
                  <div><span className="text-muted-foreground/60 text-xs">Priority</span><div className="flex gap-0.5 mt-1">{[1,2,3,4,5].map((i) => <div key={i} className={cn("w-2 h-2 rounded-full", i <= (selectedContact.priority ?? 0) ? "bg-accent" : "bg-surface-2")} />)}</div></div>
                  {selectedContact.nextFollowUp && <div><span className="text-muted-foreground/60 text-xs">Next Follow-up</span><div className="text-foreground/80">{new Date(selectedContact.nextFollowUp).toLocaleDateString()}</div></div>}
                </div>

                {/* Tags */}
                {selectedContact.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">{selectedContact.tags.map((tag) => <Badge key={tag} variant="secondary" className="text-xs bg-surface-2/60 text-foreground/50 border-0">{tag}</Badge>)}</div>
                )}

                {/* Notes */}
                {selectedContact.notes && (
                  <div className="p-3 rounded-lg bg-surface-2/30 border border-border">
                    <div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">Notes</div>
                    <div className="text-sm text-foreground/70 whitespace-pre-wrap">{selectedContact.notes}</div>
                  </div>
                )}

                {/* Touch Points Timeline */}
                {selectedContact.touchPoints && selectedContact.touchPoints.length > 0 && (
                  <div>
                    <div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">Activity</div>
                    <div className="space-y-2">
                      {selectedContact.touchPoints.slice().reverse().slice(0, 10).map((tp, i) => {
                        const Icon = TOUCH_ICONS[tp.type] || StickyNoteIcon;
                        return (
                          <div key={i} className="flex items-start gap-2.5">
                            <div className="w-6 h-6 rounded-lg bg-surface-2/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Icon className="size-3 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-foreground/70">{tp.summary}</div>
                              <div className="text-[10px] text-muted-foreground/40">{relativeTime(tp.timestamp)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="text-[10px] text-muted-foreground/30">Added {new Date(selectedContact.createdAt).toLocaleDateString()}</div>
              </div>
            </>
          )}

          {selectedContact && editing && (
            <>
              <DialogHeader><DialogTitle className="text-foreground">Edit Contact</DialogTitle></DialogHeader>
              <ContactForm form={form} setForm={setForm} onSubmit={handleSave} submitLabel="Save Changes" onCancel={() => setEditing(false)} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared Contact Form
// ---------------------------------------------------------------------------

function ContactForm({ form, setForm, onSubmit, submitLabel, onCancel }: {
  form: { name: string; email: string; phone: string; company: string; tags: string; notes: string; status: ContactStatus; priority: number; source: string; dealValue: string; nextFollowUp: string };
  setForm: (f: typeof form) => void;
  onSubmit: () => void;
  submitLabel: string;
  onCancel?: () => void;
}) {
  const inputClass = "w-full bg-surface-2/40 rounded-xl px-3 py-2.5 text-sm text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-accent/30 placeholder:text-foreground/20";

  return (
    <div className="space-y-3 mt-2">
      <div className="grid grid-cols-2 gap-3">
        <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name *" className={inputClass} />
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email *" className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className={inputClass} />
        <input type="text" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company" className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ContactStatus })} className={cn(inputClass, "cursor-pointer")}>
          <option value="lead">Lead</option>
          <option value="active">Active</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
          <option value="closed">Closed</option>
        </select>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Priority:</span>
          <div className="flex gap-1">
            {[1,2,3,4,5].map((i) => (
              <button key={i} type="button" onClick={() => setForm({ ...form, priority: i })}
                className={cn("w-6 h-6 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                  i <= form.priority ? "bg-accent/20 text-accent" : "bg-surface-2 text-muted-foreground/30"
                )}>{i}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input type="text" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Source (referral, conference...)" className={inputClass} />
        <input type="number" value={form.dealValue} onChange={(e) => setForm({ ...form, dealValue: e.target.value })} placeholder="Deal value ($)" className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Tags (comma-separated)" className={inputClass} />
        <input type="date" value={form.nextFollowUp} onChange={(e) => setForm({ ...form, nextFollowUp: e.target.value })} className={cn(inputClass, "cursor-pointer")} title="Next follow-up date" />
      </div>
      <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" rows={3} className={cn(inputClass, "resize-none")} />
      <div className="flex justify-end gap-2 pt-1">
        {onCancel && <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>}
        <Button size="sm" onClick={onSubmit} disabled={!form.name.trim() || !form.email.trim()} className="gap-1.5">
          <SaveIcon className="size-3" /> {submitLabel}
        </Button>
      </div>
    </div>
  );
}
