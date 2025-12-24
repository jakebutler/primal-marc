import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { redirectToSignIn } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Public routes: landing page, request access API, webhooks, and auth pages
const isPublicRoute = createRouteMatcher([
  "/",
  "/api/request-access",
  "/api/webhooks(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  try {
    // Protect all routes except public ones
    if (!isPublicRoute(request)) {
      const { userId } = await auth();
      if (!userId) {
        // Prevent redirect loops - don't redirect if already going to sign-in/sign-up
        const url = new URL(request.url);
        const pathname = url.pathname;
        
        if (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) {
          return NextResponse.next();
        }
        
        // Only include the pathname (not full URL) to prevent redirect loops
        // Don't include query params that might contain redirect_url
        const returnUrl = pathname === "/" ? "/" : pathname;
        return redirectToSignIn({ returnBackUrl: returnUrl });
      }
    }
    
    return NextResponse.next();
  } catch (error) {
    // Log error but don't crash - allow the request to continue
    console.error("Middleware error:", error);
    return NextResponse.next();
  }
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};

