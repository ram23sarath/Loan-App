// Base row types matching the database tables
export type Customer = {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  created_at: string;
};

export type Loan = {
  id: string;
  customer_id: string;
  original_amount: number;
  interest_amount: number;
  payment_date: string;
  total_instalments: number;
  created_at: string;
};

export type Subscription = {
  id: string;
  customer_id: string;
  amount: number;
  year: number;
  date: string;
  receipt: string;
  created_at: string;
};

export type Installment = {
  id: string;
  loan_id: string;
  installment_number: number;
  amount: number;
  date: string;
  receipt_number: string;
  late_fee: number | null;
  created_at: string;
};

// Types for application state that include joined data
export type LoanWithCustomer = Loan & {
  customers: { name: string } | null;
};

export type SubscriptionWithCustomer = Subscription & {
  customers: { name: string } | null;
};

// Supabase Database definition
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string
          user_id: string
          name: string
          phone: string
          created_at: string
        }
        Insert: {
          user_id: string
          name: string
          phone: string
        }
        Update: {
          name?: string
          phone?: string
        }
        Relationships: []
      }
      loans: {
        Row: {
          id: string
          customer_id: string
          original_amount: number
          interest_amount: number
          payment_date: string
          total_instalments: number
          created_at: string
        }
        Insert: {
          customer_id: string
          original_amount: number
          interest_amount: number
          payment_date: string
          total_instalments: number
        }
        Update: {
          original_amount?: number
          interest_amount?: number
          payment_date?: string
          total_instalments?: number
        }
        Relationships: [
          {
            foreignKeyName: "loans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      subscriptions: {
        Row: {
          id: string
          customer_id: string
          amount: number
          year: number
          date: string
          receipt: string
          created_at: string
        }
        Insert: {
          customer_id: string
          amount: number
          year: number
          date: string
          receipt: string
        }
        Update: {
          amount?: number
          year?: number
          date?: string
          receipt?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      installments: {
        Row: {
          id: string
          loan_id: string
          installment_number: number
          amount: number
          date: string
          receipt_number: string
          late_fee: number | null
          created_at: string
        }
        Insert: {
          loan_id: string
          installment_number: number
          amount: number
          date: string
          receipt_number: string
          late_fee?: number | null
        }
        Update: {
          installment_number?: number
          amount?: number
          date?: string
          receipt_number?: string
          late_fee?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "installments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Omit types for Supabase inserts
export type NewCustomer = Database['public']['Tables']['customers']['Insert'];
export type NewLoan = Database['public']['Tables']['loans']['Insert'];
export type NewSubscription = Database['public']['Tables']['subscriptions']['Insert'];
export type NewInstallment = Database['public']['Tables']['installments']['Insert'];