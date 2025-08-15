// src/app/page.tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Boxes, Share2, Inbox, Building2, PlusSquare, LineChart } from "lucide-react";

export default function Page() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome 👋</h1>
        <p className="text-sm text-muted-foreground">
          Use the left sidebar to navigate between features.
        </p>
      </section>

      {/* Static overview (ไม่มีลิงก์ / ปุ่ม) */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Boxes className="h-4 w-4" />
              Inventory
            </CardTitle>
            <CardDescription>Manage stock by brand / model / DOT.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Open from the sidebar.
          </CardContent>
        </Card>

        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Transfer Platform
            </CardTitle>
            <CardDescription>Request tyres from other branches via cart.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Open from the sidebar.
          </CardContent>
        </Card>

        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              Transfer Requests
            </CardTitle>
            <CardDescription>Track incoming & outgoing requests.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Open from the sidebar.
          </CardContent>
        </Card>

        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Branches
            </CardTitle>
            <CardDescription>Browse and manage branch information.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Open from the sidebar.
          </CardContent>
        </Card>

        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PlusSquare className="h-4 w-4" />
              Add Branch
            </CardTitle>
            <CardDescription>Create a new branch and store it in Firestore.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Open from the sidebar.
          </CardContent>
        </Card>

        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <LineChart className="h-4 w-4" />
              Analytics (soon)
            </CardTitle>
            <CardDescription>Sales, stock velocity, promotions performance.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Coming next
          </CardContent>
        </Card>
      </section>

      {/* Tips */}
      <section className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notes</CardTitle>
            <CardDescription>All navigation is via the left sidebar.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <Badge variant="secondary">Heads up</Badge>{" "}
            If you still see <strong>404</strong> on any menu, make sure that route
            exists (e.g. <code>/inventory</code>, <code>/transfer</code>,
            <code>/transfer-requests</code>, <code>/branches</code>, <code>/branches/new</code>).
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
