import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient } from '@mindscript/auth/server';
import { ProfileEdit } from '@/components/profile';

export const metadata: Metadata = {
  title: 'Edit Profile | MindScript',
  description: 'Edit your MindScript profile'
};

export default async function ProfileEditPage() {
  const supabase = await createServerClient();
  
  // Check authentication
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    redirect('/auth/login');
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <ProfileEdit />
    </div>
  );
}