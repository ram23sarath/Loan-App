export type DataEntry = {
  id: string;
  customer_id: string;
  date: string;
  amount: number;
  receipt_number: string;
  type: "credit" | "debit" | "expense"; // Type of transaction
  notes?: string;
  subtype?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
};

// Base row types matching the database tables
export type Customer = {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  station_name?: string | null;
  created_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
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
  deleted_at?: string | null;
  deleted_by?: string | null;
};

export type Subscription = {
  id: string;
  customer_id: string;
  amount: number;
  date: string;
  receipt: string;
  late_fee?: number | null;
  created_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
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
  deleted_at?: string | null;
  deleted_by?: string | null;
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
          station_name?: string | null
          created_at: string
          deleted_at?: string | null
          deleted_by?: string | null
        }
        Insert: {
          user_id: string
          name: string
          phone: string
          station_name?: string | null
        }
        Update: {
          name?: string
          phone?: string
          station_name?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
          deleted_at?: string | null;
          deleted_by?: string | null;
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
          deleted_at?: string | null;
          deleted_by?: string | null;
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
          type: "credit" | "debit" | "expense";
          notes?: string;
          subtype?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
        };
        Insert: {
          customer_id: string;
          date: string;
          amount: number;
          receipt_number: string;
          type: "credit" | "debit" | "expense";
          notes?: string;
          subtype?: string | null;
        };
        Update: {
          customer_id?: string;
          date?: string;
          amount?: number;
          receipt_number?: string;
          type?: "credit" | "debit" | "expense";
          notes?: string;
          subtype?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
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
          deleted_at?: string | null
          deleted_by?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
      },
      system_notifications: {
        Row: {
          id: string
          created_at: string
          type: string
          message: string
          status: string
        }
        Insert: {
          type: string
          message: string
          status: string
        }
        Update: {
          type?: string
          message?: string
          status?: string
        }
        Relationships: []
      }
      customer_interest: {
        Row: {
          id: string
          customer_id: string
          total_interest_charged: number
          last_applied_quarter: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          customer_id: string
          total_interest_charged?: number
          last_applied_quarter?: string | null
        }
        Update: {
          total_interest_charged?: number
          last_applied_quarter?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_interest_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
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
export type NewDataEntry = Database['public']['Tables']['data_entries']['Insert'];
export type NewLoan = Database['public']['Tables']['loans']['Insert'];
export type NewSubscription = Database['public']['Tables']['subscriptions']['Insert'];
export type NewInstallment = Database['public']['Tables']['installments']['Insert'];
export type NewLoanSeniority = Database['public']['Tables']['loan_seniority']['Insert'];

// ============================================================================
// NATIVE BRIDGE TYPES - Mobile WebView Integration
// ============================================================================
// Extend Window interface to include native bridge globals
declare global {
  interface Window {
    /**
     * Check if running inside native mobile app
     */
    isNativeApp?: () => boolean;

    /**
     * Register handler for messages from native app
     */
    registerNativeHandler?: (
      handler: (message: NativeToWebMessage) => void,
    ) => void;

    /**
     * Send a command to the native app
     */
    sendToNative?: (type: string, payload?: any) => void;

    /**
     * Convenience API for native bridge operations
     */
    NativeBridge?: {
      requestAuth: () => void;
      logout: () => void;
      updateSession: (session: AuthSession) => void;
      openExternalLink: (url: string) => void;
      hapticFeedback: (style: 'light' | 'medium' | 'heavy') => void;
      share: (content: { title?: string; text: string; url?: string }) => void;
      copyToClipboard: (text: string) => void;
      requestPushPermission: () => void;
      reportPageLoad: (route: string, title?: string) => void;
      reportError: (message: string, stack?: string, componentStack?: string) => void;
      reportTheme: (mode: 'light' | 'dark') => void;
    };

    /**
     * Queue for messages received before handler is registered
     */
    __nativeMessageQueue?: NativeToWebMessage[];
    __NATIVE_BRIDGE_INITIALIZED?: boolean;
  }
}

/**
 * Types for native bridge messages
 */
export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: {
    id: string;
    email?: string;
    isScopedCustomer?: boolean;
    scopedCustomerId?: string | null;
  };
}

export type NativeToWebMessage =
  | { type: 'AUTH_TOKEN'; payload: AuthSession }
  | { type: 'AUTH_CLEARED' }
  | {
    type: 'PUSH_TOKEN';
    payload: { token: string; platform: 'ios' | 'android' | 'unknown' };
  }
  | {
    type: 'PUSH_PERMISSION_RESULT';
    payload: { granted: boolean; canAskAgain: boolean };
  }
  | { type: 'THEME_CHANGE'; payload: { mode: 'light' | 'dark' | 'system' } }
  | {
    type: 'NETWORK_STATUS';
    payload: { isConnected: boolean; type: string | null };
  }
  | { type: 'APP_STATE'; payload: { state: string } }
  | { type: 'DEEP_LINK'; payload: { url: string; path: string } }
  | { type: 'NATIVE_READY' };