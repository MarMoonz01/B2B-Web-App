"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { Skeleton } from "@/components/ui/skeleton";

type Branch = {
  id: string;
  name: string;
  address?: string;
};

export default function BranchesView() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBranches() {
      try {
        // ใช้ API เดิมที่ดึงทุกสาขา
        const res = await fetch("/api/branches/visible");
        const data = await res.json();
        if (data.ok) {
          setBranches(data.branches);
        }
      } catch (error) {
        console.error("Failed to fetch branches:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchBranches();
  }, []);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Branches</h1>
        <Button asChild>
          <Link href="/branches/new">Add New Branch</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.map((branch) => (
          <Card key={branch.id}>
            <CardHeader>
              <CardTitle>{branch.name}</CardTitle>
              <CardDescription>
                {branch.address || "No address provided"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge>{branch.id}</Badge>
            </CardContent>
            <CardFooter>
              <Button variant="outline" asChild>
                {/* ลิงก์ยังคงไปที่ /branches/[id] เหมือนเดิม */}
                <Link href={`/branches/${branch.id}`}>Manage</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}