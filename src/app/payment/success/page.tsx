import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  return (
    <DashboardLayout>
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md border-white/10">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold">Payment Successful!</h1>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-white/60">
              Your payment has been processed successfully. Your spell execution has been queued and
              will start shortly.
            </p>
            {searchParams.session_id && (
              <p className="text-xs text-white/40 font-mono">
                Session ID: {searchParams.session_id}
              </p>
            )}
            <div className="flex gap-4 pt-4">
              <Link href="/casts" className="flex-1">
                <Button className="w-full bg-white hover:bg-white text-black/90">
                  View Cast History
                </Button>
              </Link>
              <Link href="/" className="flex-1">
                <Button variant="outline" className="w-full">
                  Browse More Spells
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
