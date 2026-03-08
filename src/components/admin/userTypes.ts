export interface UserRow {
  user_id: string;
  full_name: string;
  phone: string;
  status: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
  total_deliveries?: number;
  avg_rating?: number;
}
