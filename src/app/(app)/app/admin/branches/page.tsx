"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Plus, Search, RefreshCcw, Filter, ShieldAlert } from "lucide-react";

// No navigation: cards show info only (no click-through)
// Endpoint: /api/admin/branches
// Supports both string[] and object[] payloads

type BranchStatus = "active" | "inactive" | "under_review" | string;

export type BranchItem =
  | string
  | {
      id: string;
      code?: string;
      name?: string;
      region?: string;
      status?: BranchStatus;
      address?: string;
      phone?: string;
      email?: string;
      updatedAt?: string;
    };

export default function AdminBranchesCardGrid() {
  const router = useRouter();
  const [rawBranches, setRawBranches] = useState<BranchItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  const fetchBranches = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/branches", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch branches");
      const data = await res.json();
      const list = Array.isArray(data)
        ? (data as BranchItem[])
        : Array.isArray(data?.branches)
        ? (data.branches as BranchItem[])
        : [];
      setRawBranches(list);
    } catch (e: any) {
      setError(e?.message ?? "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  type Normalized = {
    id: string;
    title: string;
    subtitle?: string;
    badges: string[];
    meta: { label: string; value: string }[];
  };

  const branches: Normalized[] = useMemo(() => {
    const mapOne = (item: BranchItem): Normalized | null => {
      if (typeof item === "string") {
        return {
          id: item,
          title: item,
          badges: [],
          meta: [],
        };
      }
      if (!item?.id && !item?.code && !item?.name) return null;
      const title = item.name || item.code || item.id;
      const subtitleParts = [item.code && item.name ? undefined : item.code, item.region]
        .filter(Boolean)
        .slice(0, 2);
      const badges: string[] = [];
      if (item.status) badges.push(String(item.status));
      const meta: { label: string; value: string }[] = [];
      if (item.address) meta.push({ label: "Address", value: item.address });
      if (item.phone) meta.push({ label: "Phone", value: item.phone });
      if (item.email) meta.push({ label: "Email", value: item.email });
      if (item.updatedAt) meta.push({ label: "Updated", value: new Date(item.updatedAt).toLocaleString() });
      if (!meta.length) meta.push({ label: "ID", value: item.id });
      return { id: item.id || item.code || title, title, subtitle: subtitleParts.join(" • ") || undefined, badges, meta };
    };

    const list = (rawBranches || []).map(mapOne).filter(Boolean) as Normalized[];

    const term = q.trim().toLowerCase();
    return list.filter((b) => {
      const hitsTerm = !term || [b.id, b.title, b.subtitle, ...b.meta.map((m) => `${m.label} ${m.value}`)]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(term));
      const hitsStatus = status === "all" || b.badges.some((x) => x.toLowerCase() === status);
      return hitsTerm && hitsStatus;
    });
  }, [rawBranches, q, status]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Branch Management</h1>
          <p className="text-sm text-muted-foreground">แสดงสาขาในรูปแบบการ์ด — ไม่มีการกดเข้าไปหน้าแยก</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchBranches} aria-label="Refresh branches">
            <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button onClick={() => router.push("/branches/new")}>
            <Plus className="h-4 w-4 mr-2" /> Add New Branch
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Overview</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") fetchBranches(); }}
              className="pl-8"
              placeholder="Search by name/code/region..."
              aria-label="Search branches"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" className="hidden md:inline-flex" disabled>
              <Filter className="h-4 w-4 mr-2" /> More filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="destructive" role="alert">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Failed to load</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Card Grid */}
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">All Branches</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-4 rounded-2xl border space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-2xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : branches.length === 0 ? (
            <div className="text-center py-14">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border">
                <Building2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-medium">No branches found</h3>
              <p className="text-sm text-muted-foreground mt-1">ลองปรับคำค้นหา หรือสร้างสาขาใหม่</p>
              <div className="mt-4">
                <Button onClick={() => router.push("/branches/new")}>
                  <Plus className="h-4 w-4 mr-2" /> Add your first branch
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {branches.map((b) => (
                <div key={b.id} className="p-4 rounded-2xl border bg-card hover:bg-muted/40 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-muted flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium truncate text-base">{b.title}</div>
                        <div className="flex items-center gap-1">
                          {b.badges.map((x) => (
                            <Badge key={x} variant={x === 'active' ? 'default' : x === 'inactive' ? 'secondary' : 'outline'} className="capitalize">
                              {x.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {b.subtitle && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">{b.subtitle}</div>
                      )}
                    </div>
                  </div>

                  {/* meta rows */}
                  <div className="mt-3 grid grid-cols-1 gap-1.5 text-xs text-muted-foreground">
                    {b.meta.map((m) => (
                      <div key={m.label} className="truncate">
                        <span className="text-muted-foreground">{m.label}: </span>
                        <span className="text-foreground">{m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
