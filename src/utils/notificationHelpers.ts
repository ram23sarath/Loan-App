import { supabase } from '../lib/supabase';
import { formatCurrencyIN } from './numberFormatter';
import type { Installment, Loan, Customer } from '../types';

export type NotificationType = 'backup' | 'user_created' | 'seniority_request' | 'installment_default' | 'quarterly_interest' | 'system';

export interface SystemNotification {
  type: NotificationType;
  status: 'pending' | 'success' | 'warning' | 'error';
  message: string;
  metadata?: Record<string, any>;
}

/**
 * Create a system notification
 */
export const createSystemNotification = async (notification: SystemNotification): Promise<void> => {
  try {
    const { error } = await supabase
      .from('system_notifications')
      .insert([
        {
          type: notification.type,
          status: notification.status,
          message: notification.message,
          metadata: notification.metadata || {},
        }
      ]);

    if (error) throw error;
  } catch (err) {
    console.error('Failed to create notification:', err);
    // Don't throw - let the operation continue even if notification fails
  }
};

/**
 * Normalize date to start of day in UTC for consistent date comparisons
 */
const startOfDayUTC = (date: Date): Date => {
  const utc = new Date(date);
  utc.setUTCHours(0, 0, 0, 0);
  return utc;
};

/**
 * Calculate days difference between two UTC dates
 */
const differenceInDaysUTC = (dateA: Date, dateB: Date): number => {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((dateA.getTime() - dateB.getTime()) / msPerDay);
};

/**
 * Detect overdue installments (past due date and not paid)
 */
export const detectOverdueInstallments = (
  installments: Installment[],
  loans: Loan[],
  customers: Customer[]
): Array<{ installment: Installment; loan: Loan; customer: Customer; daysOverdue: number }> => {
  const today = startOfDayUTC(new Date());
  const loanMap = new Map(loans.map(l => [l.id, l]));
  const customerMap = new Map(customers.map(c => [c.id, c]));

  const result: Array<{ installment: Installment; loan: Loan; customer: Customer; daysOverdue: number }> = [];

  for (const inst of installments) {
    // Only process installments that are not paid (no receipt_number)
    if (inst.receipt_number) continue;

    const instDate = startOfDayUTC(new Date(inst.date));
    // Check if overdue: installment date must be strictly before today
    if (instDate >= today) continue;

    const loan = loanMap.get(inst.loan_id);
    if (!loan) continue;

    const customer = customerMap.get(loan.customer_id);
    if (!customer) continue;

    const daysOverdue = differenceInDaysUTC(today, instDate);
    result.push({ installment: inst, loan, customer, daysOverdue });
  }

  return result;
};

/**
 * Format overdue installment notification message
 */
export const formatInstallmentDefaultMessage = (
  customer: Customer,
  installmentNumber: number,
  amount: number,
  daysOverdue: number
): string => {
  const formattedAmount = formatCurrencyIN(amount);
  
  if (daysOverdue > 30) {
    return `⚠️ URGENT: ${customer.name} - Installment #${installmentNumber} (${formattedAmount}) is ${daysOverdue} days overdue`;
  } else if (daysOverdue > 7) {
    return `⚠️ ${customer.name} - Installment #${installmentNumber} (${formattedAmount}) is ${daysOverdue} days overdue`;
  }
  return `📋 ${customer.name} - Installment #${installmentNumber} (${formattedAmount}) is ${daysOverdue} days overdue`;
};

/**
 * Check and create notifications for overdue installments
 * Returns the count of newly created notifications
 */
export const checkAndNotifyOverdueInstallments = async (
  installments: Installment[],
  loans: Loan[],
  customers: Customer[]
): Promise<number> => {
  try {
    const overdueInstallments = detectOverdueInstallments(installments, loans, customers);

    if (overdueInstallments.length === 0) {
      return 0;
    }

    // Fetch existing notifications for these installments in last 24 hours
    // Only select installmentId from metadata to minimize data transfer
    // A future optimization could use PostgreSQL JSONB operators if Supabase RLS supports it
    const { data: existingNotifications } = await supabase
      .from('system_notifications')
      .select('metadata')
      .eq('type', 'installment_default')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1000);

    // Build a Set of already-notified installment IDs for O(1) lookup
    const notifiedInstallmentIds = new Set(
      (existingNotifications || [])
        .map((notif: any) => notif.metadata?.installmentId)
        .filter((id): id is string => !!id)
    );

    // Prepare notification objects for batch insert (only for missing IDs)
    const notificationsToInsert: Array<{
      type: NotificationType;
      status: SystemNotification['status'];
      message: string;
      metadata: Record<string, any>;
    }> = [];

    for (const { installment, loan, customer, daysOverdue } of overdueInstallments) {
      // Only create if no recent notification exists for this installment
      if (!notifiedInstallmentIds.has(installment.id)) {
        const statusValue: SystemNotification['status'] = daysOverdue > 30 ? 'error' : daysOverdue > 7 ? 'warning' : 'pending';
        const message = formatInstallmentDefaultMessage(
          customer,
          installment.installment_number,
          installment.amount,
          daysOverdue
        );

        notificationsToInsert.push({
          type: 'installment_default',
          status: statusValue,
          message,
          metadata: {
            customerId: customer.id,
            loanId: loan.id,
            installmentId: installment.id,
            installmentNumber: installment.installment_number,
            amount: installment.amount,
            daysOverdue,
            dueDate: installment.date,
          },
        });
      }
    }

    // Perform single batch insert if there are notifications to add
    if (notificationsToInsert.length > 0) {
      const { error } = await supabase
        .from('system_notifications')
        .insert(notificationsToInsert);

      if (error) {
        console.error('Failed to batch insert notifications:', error);
        return 0;
      }
    }

    return notificationsToInsert.length;
  } catch (err) {
    console.error('Failed to check overdue installments:', err);
    return 0;
  }
};
