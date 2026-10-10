import { Check, Clock, FileQuestion, Hourglass, MessageCircleReply, Undo2, X } from 'lucide-react';
import type { KycStatusMap, PaymentStatus, TicketStatus } from '@spova/shared';
import { Badge } from '@/components/ui';

type GroupStatus = KycStatusMap['poi'];

/** KYC group / document state as a chip. `incomplete` is the "nothing uploaded yet" state. */
export function KycChip({ status, className }: { status: GroupStatus; className?: string }) {
  switch (status) {
    case 'approved':
      return (
        <Badge tone="success" className={className}>
          <Check className="h-3 w-3" strokeWidth={3} /> Approved
        </Badge>
      );
    case 'pending':
      return (
        <Badge tone="info" className={className}>
          <Hourglass className="h-3 w-3" /> In review
        </Badge>
      );
    case 'rejected':
      return (
        <Badge tone="danger" className={className}>
          <X className="h-3 w-3" strokeWidth={3} /> Rejected
        </Badge>
      );
    default:
      return (
        <Badge className={className}>
          <FileQuestion className="h-3 w-3" /> Not uploaded
        </Badge>
      );
  }
}

/** Deposit / withdrawal request state. */
export function PaymentChip({ status, className }: { status: PaymentStatus; className?: string }) {
  switch (status) {
    case 'approved':
      return (
        <Badge tone="success" className={className}>
          <Check className="h-3 w-3" strokeWidth={3} /> Approved
        </Badge>
      );
    case 'declined':
      return (
        <Badge tone="danger" className={className}>
          <X className="h-3 w-3" strokeWidth={3} /> Declined
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge className={className}>
          <Undo2 className="h-3 w-3" /> Cancelled
        </Badge>
      );
    default:
      return (
        <Badge tone="warning" className={className}>
          <Clock className="h-3 w-3" /> Pending
        </Badge>
      );
  }
}

/** Support ticket state. */
export function TicketChip({ status, className }: { status: TicketStatus; className?: string }) {
  switch (status) {
    case 'answered':
      return (
        <Badge tone="brand" className={className}>
          <MessageCircleReply className="h-3 w-3" /> Answered
        </Badge>
      );
    case 'closed':
      return (
        <Badge className={className}>
          <Check className="h-3 w-3" strokeWidth={3} /> Closed
        </Badge>
      );
    default:
      return (
        <Badge tone="warning" dot className={className}>
          Open
        </Badge>
      );
  }
}
