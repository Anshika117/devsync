import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import ProfileForm from "@/components/ProfileForm"

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userId = session.user.id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, image: true, lcUsername: true, cfHandle: true, bufferDay: true },
  })

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8 max-w-2xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-gray-400 text-sm mt-1">
          Manage your sync sources, preferences, and account.
        </p>
      </div>

      <div className="mb-10">
        <ProfileForm
          lcUsername={user?.lcUsername ?? ""}
          cfHandle={user?.cfHandle ?? ""}
          bufferDay={user?.bufferDay ?? null}
        />
      </div>

      {/* Account */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
          Account
        </h2>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {user?.image && (
              <img src={user.image} alt="avatar" className="w-10 h-10 rounded-full shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-semibold truncate">{user?.name ?? "—"}</p>
              <p className="text-sm text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/login" })
            }}
          >
            <button
              type="submit"
              className="bg-gray-800 hover:bg-red-900/50 hover:text-red-300 text-gray-300 font-semibold px-4 py-2 rounded-lg transition text-sm cursor-pointer shrink-0"
            >
              Sign Out
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
