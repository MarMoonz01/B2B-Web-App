"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

// icons & ui
import { BadgeCheck, Check, Clock, FileSpreadsheet, Loader2, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// --- util (ใช้ร่วมกับ wizard) ---
import { slugifyId } from "@/lib/services/InventoryService";

// ---------- Types ----------
type Application = {
  id: string;
  branchName: string;
  storeId: string;
  email: string;
  contactName?: string;
  phone?: string | null;
  location?: string;
  notes?: string | null;
  status: "pending" | "approved" | "rejected";
  submittedAt?: any; // Firestore Timestamp
  fileName?: string | null;
  inventoryData?: Array<{
    sku?: string;
    brand: string;
    model: string;
    size: string;
    loadIndex?: string;
    dotCode?: string;
    qty: number;
    basePrice?: number;
    promoPrice?: number | null;
  }> | null;
};

// ---------- Page ----------
export default function AdminApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const q = query(collection(db, "branchApplications"), orderBy("submittedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const rows: Application[] = [];
      snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as any) }));
      setApps(rows);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const shown = useMemo(() => {
    const byStatus = filter === "all" ? apps : apps.filter((a) => a.status === filter);
    const kw = search.trim().toLowerCase();
    if (!kw) return byStatus;
    return byStatus.filter(
      (a) =>
        a.branchName?.toLowerCase().includes(kw) ||
        a.storeId?.toLowerCase().includes(kw) ||
        a.email?.toLowerCase().includes(kw) ||
        a.location?.toLowerCase().includes(kw)
    );
  }, [apps, filter, search]);

  async function approve(app: Application) {
    try {
      setBusyId(app.id);
      const storeId = slugifyId(app.storeId || app.branchName);

      // 1) สร้างสาขา (stores/{storeId})
      const storeRef = doc(db, "stores", storeId);
      await setDoc(
        storeRef,
        {
          storeId,
          name: app.branchName,
          location: app.location || "",
          email: app.email || "",
          contactName: app.contactName || "",
          phone: app.phone || "",
          createdAt: serverTimestamp(),
          active: true,
        },
        { merge: true }
      );

      // 2) ถ้าผู้สมัครแนบ inventoryData มากับใบสมัคร → import เข้าคอลเลกชันย่อย
      if (app.inventoryData && app.inventoryData.length) {
        const batch = writeBatch(db);
        const invCol = collection(storeRef, "inventory");
        app.inventoryData.forEach((row, idx) => {
          // เขียนเป็น doc แยกเพื่อค้นหา/แก้ไขภายหลังง่าย
          const id = `${row.sku || `${row.brand}-${row.model}-${row.size}`}`.toLowerCase().replace(/\s+/g, "-") + "-" + idx;
          const invRef = doc(invCol, id);
          batch.set(invRef, {
            ...row,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            source: "application",
            applicationId: app.id,
          });
        });
        await batch.commit();
      }

      // 3) อัปเดตสถานะใบสมัคร
      await updateDoc(doc(db, "branchApplications", app.id), {
        status: "approved",
        approvedAt: serverTimestamp(),
      });

      toast.success("Approved and created branch: " + storeId);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Approve failed");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(app: Application) {
    try {
      setBusyId(app.id);
      await updateDoc(doc(db, "branchApplications", app.id), {
        status: "rejected",
        rejectedAt: serverTimestamp(),
      });
      toast("Application rejected", { description: app.branchName });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Reject failed");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(app: Application) {
    try {
      setBusyId(app.id);
      await deleteDoc(doc(db, "branchApplications", app.id));
      toast.success("Application deleted");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Branch Applications</h1>
          <p className="text-muted-foreground">Review and process new applications to join the network.</p>
        </div>
        <div className="flex gap-2">
          <div className="inline-flex rounded-lg border bg-white p-1">
            {(["pending", "approved", "rejected", "all"] as const).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={filter === k ? "default" : "ghost"}
                onClick={() => setFilter(k)}
                className="capitalize"
              >
                {k}
              </Button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex items-center gap-3">
        <div className="w-80">
          <Label className="text-xs">Search</Label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search branch / storeId / email / location"
            className="mt-1"
          />
        </div>
      </div>

      <Separator />

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading applications...
        </div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No applications.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shown.map((a) => {
            const submitted = a.submittedAt?.toDate
              ? a.submittedAt.toDate().toLocaleString()
              : "-";
            return (
              <Card key={a.id} className="rounded-2xl shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{a.branchName}</CardTitle>
                      <CardDescription className="text-xs">{a.email}</CardDescription>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    <div><b>Submitted:</b> {submitted}</div>
                    {a.notes && <div className="line-clamp-2"><b>Notes:</b> {a.notes}</div>}
                    <div className="flex items-center gap-2 mt-1">
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      <span className="truncate">{a.fileName || "No CSV"}</span>
                      {a.inventoryData?.length ? (
                        <span className="text-xs text-slate-500">({a.inventoryData.length} rows)</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Approve */}
                    <Confirm
                      disabled={busyId === a.id || a.status !== "pending"}
                      title="Approve this application?"
                      desc="A new branch will be created and (if provided) inventory will be imported."
                      actionLabel="Approve"
                      actionVariant="default"
                      onConfirm={() => approve(a)}
                      icon="approve"
                      busy={busyId === a.id}
                    />

                    {/* Reject */}
                    <Confirm
                      disabled={busyId === a.id || a.status !== "pending"}
                      title="Reject this application?"
                      desc="The applicant will not be added to the network. You can still delete later."
                      actionLabel="Reject"
                      actionVariant="destructive"
                      onConfirm={() => reject(a)}
                      icon="reject"
                      busy={busyId === a.id}
                    />

                    {/* Delete (visible for non-pending) */}
                    {a.status !== "pending" && (
                      <Confirm
                        disabled={busyId === a.id}
                        title="Delete this application?"
                        desc="This cannot be undone."
                        actionLabel="Delete"
                        actionVariant="destructive"
                        onConfirm={() => remove(a)}
                        icon="delete"
                        busy={busyId === a.id}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- UI helpers ---------------- */

function StatusBadge({ status }: { status: Application["status"] }) {
  if (status === "approved") {
    return (
      <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 text-xs">
        <BadgeCheck className="h-3.5 w-3.5" /> Approved
      </div>
    );
  }
  if (status === "rejected") {
    return (
      <div className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 px-2.5 py-1 text-xs">
        <X className="h-3.5 w-3.5" /> Rejected
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 px-2.5 py-1 text-xs">
      <Clock className="h-3.5 w-3.5" /> Pending
    </div>
  );
}

type ConfirmProps = {
  disabled?: boolean;
  title: string;
  desc: string;
  actionLabel: string;
  actionVariant: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
  icon: "approve" | "reject" | "delete";
  busy?: boolean;
};
function Confirm({
  disabled,
  title,
  desc,
  actionLabel,
  actionVariant,
  onConfirm,
  icon,
  busy,
}: ConfirmProps) {
  const Icon =
    icon === "approve" ? Check :
    icon === "reject" ? X :
    Shield;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          disabled={disabled}
          variant={actionVariant === "destructive" ? "destructive" : "default"}
          className="gap-2"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
          {actionLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{desc}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={actionVariant === "destructive" ? "bg-red-600 hover:bg-red-700" : ""}
            onClick={() => onConfirm()}
          >
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
