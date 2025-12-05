export type DataEntry = {
  id: string;
  customer_id: string;
  date: string;
  amount: number;
  receipt_number: string;
  notes?: string;
  subtype?: string | null;
};

export type NewDataEntry = Omit<DataEntry, 'id'>;
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
  check_number?: string | null;
  created_at: string;
};

export type Subscription = {
  id: string;
  customer_id: string;
  amount: number;
  date: string;
  receipt: string;
  late_fee?: number | null;
  created_at: string;
};

// For react-hook-form SubscriptionInputs
export type SubscriptionInputs = {
  amount: number;
  date: string;
  receipt: string;
  late_fee?: number | null;
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
  customers: { name: string; phone: string } | null;
};

export type SubscriptionWithCustomer = Subscription & {
  customers: { name: string; phone: string } | null;
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
          check_number?: string | null
          created_at: string
        }
        Insert: {
          customer_id: string
          original_amount: number
          interest_amount: number
          payment_date: string
          total_instalments: number
          check_number?: string | null
        }
        Update: {
          original_amount?: number
          interest_amount?: number
          payment_date?: string
          total_instalments?: number
          check_number?: string | null
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
          date: string
          receipt: string
          late_fee?: number | null
          created_at: string
        }
        Insert: {
          customer_id: string
          amount: number
          date: string
          receipt: string
          late_fee?: number | null
        }
        Update: {
          amount?: number
          date?: string
          receipt?: string
          late_fee?: number | null
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
      loan_seniority: {
        Row: {
          id: string;
          user_id: string;
          customer_id: string;
          station_name?: string | null;
          loan_type?: string | null;
          loan_request_date?: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          customer_id: string;
          station_name?: string | null;
          loan_type?: string | null;
          loan_request_date?: string | null;
        };
        Update: {
          user_id?: string;
          customer_id?: string;
          station_name?: string | null;
          loan_type?: string | null;
          loan_request_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "loan_seniority_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          }
        ];
      }
      data_entries: {
        Row: {
          id: string;
          customer_id: string;
          date: string;
          amount: number;
          receipt_number: string;
          notes?: string;
          subtype?: string | null;
        };
        Insert: {
          customer_id: string;
          date: string;
          amount: number;
          receipt_number: string;
          notes?: string;
          subtype?: string | null;
        };
        Update: {
          customer_id?: string;
          date?: string;
          amount?: number;
          receipt_number?: string;
          notes?: string;
          subtype?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "data_entries_customer_id_fkey",
            columns: ["customer_id"],
            isOneToOne: false,
            referencedRelation: "customers",
            referencedColumns: ["id"]
          }
        ];
      };
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