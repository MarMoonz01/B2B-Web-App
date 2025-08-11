import { JSX } from "react";
import { Bell, UserCircle2 } from "lucide-react";

export default function Header(): JSX.Element {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-slate-800">
            Tyre<span className="text-blue-600">Plus</span>
          </h1>
          <span className="text-xs font-semibold text-slate-500">Inventory Management System</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-medium text-slate-700">Ratchapruek Branch</div>
            <div className="text-xs text-slate-500">Admin User</div>
          </div>
          <button className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-slate-100">
            <Bell className="h-4 w-4" />
          </button>
          <button className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-slate-100">
            <UserCircle2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  )
}