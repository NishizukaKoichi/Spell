import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="min-h-screen bg-background pb-20">
      {/* ヘッダースケルトン */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div>
            <Skeleton className="h-8 w-24 mb-1" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>

        {/* 検索バースケルトン */}
        <div className="px-4 pb-4">
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* 注目の魔法使いスケルトン */}
        <section>
          <Skeleton className="h-6 w-32 mb-4" />
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <Skeleton className="w-16 h-16 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-24 mb-2" />
                  <Skeleton className="h-4 w-48 mb-2" />
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mb-4">
                <Skeleton className="h-6 w-8" />
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-6 w-10" />
              </div>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </section>

        {/* タブスケルトン */}
        <section>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>

          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-8 w-20" />
          </div>

          {/* 魔法使いリストスケルトン */}
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="bg-card/50 border-border/50">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-4" />
                      </div>
                      <Skeleton className="h-4 w-48 mb-2" />
                      <Skeleton className="h-3 w-24 mb-2" />
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-3 w-8" />
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-3 w-10" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
