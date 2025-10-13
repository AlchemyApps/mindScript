import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    console.log('Server-side auth test:', {
      url: supabaseUrl,
      keyPrefix: supabaseAnonKey?.substring(0, 20),
      email
    });

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Server auth error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.log('Server auth success:', data.user?.id);
    return NextResponse.json({
      success: true,
      userId: data.user?.id,
      email: data.user?.email
    });
  } catch (error: any) {
    console.error('Server error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}