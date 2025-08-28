// File: src/app/(app)/app/branches/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "@/src/lib/session";
import { db } from "@/src/lib/firebaseAdmin";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2, MapPin, ChevronRight, Plus, Factory } from "lucide-react";

// --- คงพฤติกรรมเดิม: ดึงทุกสาขาเสมอ ---
async function getAllBranches() {
  const snap = await db.collection("stores").get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

type Branch = {
  id: string;
  name?: string;
  address?: string;
  status?: "active" | "pending" | "inactive";
  storeId?: string;
  city?: string;
};

export default async function BranchesPage() {
  const me = await getServerSession();
  if (!me) redirect("/login");

  const branches = (await getAllBranches()) as Branch[];
  const total = branches.length;
  const active = branches.filter((b) => b.status === "active").length;
  const pending = branches.filter((b) => b.status === "pending").length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Hero */}
      <div className="rounded-2xl border bg-gradient-to-br from-slate-50 to-white p-5 md:p-7">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Factory className="h-6 w-6 text-slate-600" />
              Branches
            </h1>
            <p className="text-sm text-muted-foreground">
              Swipe/scroll horizontally to explore your branches.
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link href="/branches/new">
              <Plus className="h-4 w-4" />
              Add New Branch
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="rounded-xl">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-2xl font-semibold">{total}</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Active</div>
              <div className="text-2xl font-semibold">{active}</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Pending</div>
              <div className="text-2xl font-semibold">{pending}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Horizontal Cards */}
      {branches.length === 0 ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>No branches yet</CardTitle>
            <CardDescription>
              Create your first branch to start managing inventory and orders.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link href="/branches/new">Create Branch</Link>
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="space-y-2">
          <div className="text-sm font-medium">Available Branches</div>

          {/* Scroll container */}
          <div className="overflow-x-auto pb-3 [scrollbar-width:thin]">
            <div
              className="
                grid grid-flow-col
                auto-cols-[90%] sm:auto-cols-[65%] lg:auto-cols-[45%] xl:auto-cols-[36%]
                gap-4 pr-2
                snap-x snap-mandatory
              "
            >
              {branches.map((b) => {
                const name = b.name || b.storeId || b.id;
                const addr = b.address || "No address provided";
                const status = b.status || "active";

                return (
                  <Card
                    key={b.id}
                    className="group rounded-2xl border hover:shadow-md transition-shadow snap-start"
                  >
                    {/* Header banner */}
                    <div className="relative h-24 w-full overflow-hidden rounded-t-2xl bg-gradient-to-r from-indigo-500/15 via-sky-500/15 to-teal-500/15">
                      <div className="absolute inset-0 bg-[radial-gradient(800px_200px_at_20%_-20%,rgba(59,130,246,0.12),transparent)]" />
                      <div className="absolute inset-0 bg-[radial-gradient(600px_200px_at_80%_120%,rgba(16,185,129,0.12),transparent)]" />
                      <div className="absolute left-4 top-4 flex items-center gap-2">
                        <div className="h-10 w-10 rounded-xl bg-white/80 backdrop-blur flex items-center justify-center border">
                          <Building2 className="h-5 w-5 text-slate-700" />
                        </div>
                        <div className="flex flex-col">
                          <div className="text-sm font-semibold line-clamp-1">{name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{b.id}</div>
                        </div>
                      </div>
                      <div className="absolute right-4 top-4">
                        <Badge
                          variant={status === "active" ? "default" : "secondary"}
                          className={
                            status === "pending"
                              ? "bg-amber-500 hover:bg-amber-600"
                              : status === "inactive"
                              ? "bg-slate-300 text-slate-700 hover:bg-slate-400"
                              : ""
                          }
                        >
                          {status}
                        </Badge>
                      </div>
                    </div>

                    <CardHeader className="pb-2">
                      <CardTitle className="text-base" />
                      <CardDescription className="mt-1 flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 text-slate-500 shrink-0" />
                        <span className="line-clamp-2">{addr}</span>
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="pt-0">
                      {/* meta อื่น ๆ (เช่น city) */}
                      {b.city && (
                        <div className="text-xs text-slate-600">
                          City: <span className="font-medium">{b.city}</span>
                        </div>
                      )}
                    </CardContent>

                    <CardFooter className="pt-2">
                      <Button variant="outline" asChild className="w-full justify-between">
                        <Link href={`/branches/${b.id}`}>
                          Manage
                          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Tip: Drag or scroll horizontally to see more branches.
          </p>
        </div>
      )}
    </div>
  );
}
