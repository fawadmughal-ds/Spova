import { Construction } from 'lucide-react';
import { PageHeader } from '@/components/app-shell';

export function ComingSoon({ title, milestone, items }: { title: string; milestone: string; items: string[] }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="card flex max-w-2xl flex-col items-start gap-4 p-8">
        <Construction className="h-8 w-8 text-gold" />
        <div>
          <h2 className="font-semibold">Scheduled for {milestone}</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-300">
            {items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
