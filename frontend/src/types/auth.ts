export type UserRole = "customer" | "business_owner";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  customer_id?: string | null;
  business_id?: string | null;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  token_type: string;
  user: UserProfile;
  message?: string;
}

export interface RegisterCustomerPayload {
  full_name: string;
  email: string;
  password: string;
  confirm_password?: string;
  phone?: string;
}

export interface RegisterBusinessPayload {
  full_name: string;
  business_name: string;
  business_type?: string;
  email: string;
  password: string;
  confirm_password?: string;
  phone?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  role?: UserRole;
}

export interface GoogleAuthPayload {
  credential: string;
  role?: UserRole;
}

export interface MessageResponse {
  success: boolean;
  message: string;
  reset_token?: string;
}
