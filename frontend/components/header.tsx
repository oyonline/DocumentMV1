"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function Header() {
  const { loggedIn, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-stone-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        {/* Logo / Brand */}
        <Link
          href="/docs"
          className="text-lg font-semibold tracking-tight text-stone-900 hover:text-brand-600 transition-colors"
        >
          DocMV
        </Link>

        {/* Right actions */}
        {loggedIn && (
          <div className="flex items-center gap-4">
            <Link
              href="/docs/new"
              className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
            >
              + 新建文档
            </Link>
            <button
              onClick={signOut}
              className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
            >
              退出
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
