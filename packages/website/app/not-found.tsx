"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-blue-50 px-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-blue-600">404</h1>
        <h2 className="mt-4 text-3xl font-semibold text-gray-900">Page Not Found</h2>
        <p className="mt-4 text-lg text-gray-600">
          Sorry, we couldn't find the page you're looking for.
        </p>
        <div className="mt-8">
          <Link href="/">
            <Button size="lg">Return Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
