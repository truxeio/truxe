"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-blue-50 px-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-blue-600">500</h1>
        <h2 className="mt-4 text-3xl font-semibold text-gray-900">Something went wrong!</h2>
        <p className="mt-4 text-lg text-gray-600">
          We're sorry, but something unexpected happened.
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Button onClick={reset} size="lg">Try Again</Button>
          <Link href="/">
            <Button variant="outline" size="lg">Return Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
