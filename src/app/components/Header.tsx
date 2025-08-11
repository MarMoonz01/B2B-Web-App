import { JSX } from "react";
import { Bell, User, Settings } from "lucide-react";

export default function Header(): JSX.Element {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-50 backdrop-blur-md bg-white/95">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Tyre<span className="text-blue-600">Chain</span>
          </h1>
          <div className="flex items-center space-x-2">
            <span className="badge badge-info">B2B</span>
            <span className="badge bg-green-100 text-green-800">Live</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-right hidden md:block">
            <div className="text-sm font-medium text-gray-900">Demo Organization</div>
            <div className="text-xs text-gray-500">Admin Access</div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button className="btn-secondary btn-sm p-2">
              <Bell className="h-4 w-4" />
            </button>
            <button className="btn-secondary btn-sm p-2">
              <Settings className="h-4 w-4" />
            </button>
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}