import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const CardSkeleton = () => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
        <Skeleton className="h-6 w-3/4 mt-4" />
        <Skeleton className="h-4 w-full mt-2" />
      </CardHeader>
    </Card>
  );
};

export const StatCardSkeleton = () => {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
