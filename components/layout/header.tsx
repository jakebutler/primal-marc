"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { UserButton, SignInButton } from "@clerk/nextjs";
import { PrimalMarcIcon } from "@/components/icons/PrimalMarcIcon";

export function Header() {
  const { isSignedIn, isLoaded } = useUser();

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <PrimalMarcIcon size={40} className="text-primary transition-transform group-hover:scale-110" />
          <span className="text-2xl font-serif font-bold text-foreground">
            Primal Marc
          </span>
        </Link>
        <nav className="flex items-center gap-4">
          {isLoaded && (
            <>
              {isSignedIn ? (
                <>
                  <Link href="/posts">
                    <Button variant="ghost" className="hover:text-primary transition-colors">My Posts</Button>
                  </Link>
                  <Link href="/settings">
                    <Button variant="ghost" className="hover:text-primary transition-colors">Settings</Button>
                  </Link>
                  <UserButton />
                </>
              ) : (
                <SignInButton mode="modal">
                  <Button>Sign In</Button>
                </SignInButton>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

