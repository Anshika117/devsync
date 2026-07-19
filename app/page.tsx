import { auth } from "@/auth"
import { redirect } from "next/navigation"

// This route previously rendered a stale, duplicated copy of the old
// Profile page (pre-dating bufferDay, UnifiedProgressView, and the
// Settings split) that had drifted out of sync with ProfileForm's actual
// props — it was calling ProfileForm without the now-required `bufferDay`
// prop. The real profile view lives at /profile; "/" itself doesn't need
// to render anything of its own, it just routes to the right place.
export default async function RootPage() {
  const session = await auth()
  redirect(session?.user?.id ? "/dashboard" : "/login")
}
