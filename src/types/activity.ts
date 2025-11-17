export interface ActivityLog {
  id: string;
  user_id: string | null;
  action_type: string;
  action_description: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface AdminShortcut {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  path: string;
  icon: string;
  order_index: number;
  created_at: string;
}
