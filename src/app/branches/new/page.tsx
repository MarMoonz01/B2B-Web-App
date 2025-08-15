// src/app/branches/new/page.tsx
import type { Metadata } from "next";
import BranchNewView from "@/src/app/components/ฺBranchNewView";

export const metadata: Metadata = {
  title: "Add New Branch",
  description: "Create a new branch and store its metadata in Firestore.",
};

export default function NewBranchPage() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <BranchNewView />
    </div>
  );
}
