import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { redirectToSignIn } from "@clerk/nextjs/server";

// Public routes: landing page, request access API, and webhooks
const isPublicRoute = createRouteMatcher([
  "/",
  "/api/request-access",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  // Protect all routes except public ones
  if (!isPublicRoute(request)) {
    const { userId } = await auth();
    if (!userId) {
      // Redirect to Clerk's sign-in page
      return redirectToSignIn({ returnBackUrl: request.url });
    }
  }
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};

