'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, RefreshCcw, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export default function UnverifiedPage() {
    const { data: session, update } = useSession();
    const router = useRouter();
    const [checking, setChecking] = useState(false);

    const checkStatus = async () => {
        setChecking(true);
        try {
            const response = await fetch('/api/auth/status');
            const data = await response.json();

            if (data.isVerified) {
                toast.success('Your account is verified! Refreshing access...');
                // Update the session to reflect the new isVerified status in JWT
                await update({ isVerified: true });
                router.refresh();
                router.push('/');
            } else {
                toast.info('Account still pending verification.');
            }
        } catch (error) {
            toast.error('Failed to check status.');
        } finally {
            setChecking(false);
        }
    };

    // Optional: Auto-check on mount
    useEffect(() => {
        if (session?.user) {
            checkStatus();
        }
    }, []);

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="max-w-md w-full border-primary/20 shadow-lg">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        <div className="p-3 bg-primary/10 rounded-full">
                            <ShieldAlert className="w-10 size-10 text-primary" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold">Verification Required</CardTitle>
                    <CardDescription className="text-muted-foreground mt-2">
                        Your account is currently pending verification. to ensure the security and quality of our platform, we manually review all new access requests.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-center">
                    <p className="text-sm text-muted-foreground">
                        This process typically takes 24-48 hours. You will receive access once an administrator has verified your account.
                    </p>
                    <div className="p-4 bg-muted rounded-lg text-xs text-left">
                        <h4 className="font-semibold mb-1 text-foreground">Why do I need verification?</h4>
                        <p>Verification helps us prevent spam and maintain a high standard of service for all our users. We appreciate your patience!</p>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                    <Button
                        onClick={checkStatus}
                        disabled={checking}
                        className="w-full flex items-center justify-center gap-2"
                    >
                        {checking ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                        Check Status
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="w-full flex items-center justify-center gap-2"
                    >
                        <LogOut className="w-4 h-4" />
                        Logout
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
