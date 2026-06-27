import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import ProfileForm from "@/components/ProfileForm"

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, image: true, lcUsername: true, cfHandle: true }
  })

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Your Profile</h1>
      
      {/* Avatar + info */}
      <div className="flex items-center gap-4 mb-10">
        {user?.image && (
          <img src={user.image} alt="avatar" className="w-16 h-16 rounded-full" />
        )}
        <div>
          <p className="text-xl font-semibold">{user?.name}</p>
          <p className="text-gray-400">{user?.email}</p>
        </div>
      </div>

      <ProfileForm lcUsername={user?.lcUsername ?? ""} cfHandle={user?.cfHandle ?? ""} />
    </div>
  )
}