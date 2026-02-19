import { auth } from '@/app/(auth)/auth';
import { getUser } from '@/lib/db/queries';
import { NextResponse } from 'next/server';

export async function GET() {
    const session = await auth();

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const users = await getUser(session.user.email);
        if (users.length === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
            isVerified: users[0].isVerified,
            email: users[0].email
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
    }
}
