// OneAPI Service Types

export interface RegisterData {
  username: string;
  password: string;
  email?: string;
  display_name?: string;
}

export interface RegisterResult {
  success: boolean;
  message: string;
  data?: {
    id: number;
    username: string;
    token?: string;
  };
}

export interface LoginResult {
  success: boolean;
  message: string;
  data?: {
    id: number;
    username: string;
    token: string;
  };
}

export interface UserInfo {
  id: number;
  username: string;
  display_name: string;
  email: string;
  role: number;
  status: number;
  quota: number; // 余额（单位：分，需除以1000转换为元）
  used_quota: number;
  request_count: number;
  group: string;
  created_time: number;
}

export interface TopupOrder {
  success: boolean;
  message: string;
  data?: {
    trade_no: string;
    payment_url: string;
    amount: number;
  };
}

export interface LogEntry {
  id: number;
  user_id: number;
  created_at: number;
  type: number;
  content: string;
  username: string;
  token_name: string;
  model_name: string;
  quota: number;
  prompt_tokens: number;
  completion_tokens: number;
  channel: string;
}

export interface LogsResult {
  success: boolean;
  message: string;
  data: LogEntry[];
  total: number;
}

export interface StatisticsData {
  date: string;
  request_count: number;
  quota: number;
}

export interface Statistics {
  success: boolean;
  message: string;
  data: StatisticsData[];
}

export interface TopupHistoryEntry {
  id: number;
  user_id: number;
  amount: number;
  status: number;
  trade_no: string;
  created_time: number;
}

export interface TopupHistoryResult {
  success: boolean;
  message: string;
  data: TopupHistoryEntry[];
  total: number;
}

export interface OneAPIError {
  success: false;
  message: string;
  error?: string;
}
