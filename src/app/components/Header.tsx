import { JSX } from "react";

export default function Header(): JSX.Element {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Tyre<span className="text-blue-600">Chain</span>
          </h1>
          <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded">
            B2B
          </span>
        </div>
        
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">Demo Org</span>
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium">D</span>
          </div>
        </div>
      </div>
    </header>
  )
}