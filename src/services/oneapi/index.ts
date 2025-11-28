import type {
  LoginResult,
  LogsResult,
  RegisterData,
  RegisterResult,
  Statistics,
  TopupHistoryResult,
  TopupOrder,
  UserInfo,
} from './types';

/**
 * OneAPI Service
 * 封装所有 one-api API 调用
 */
export class OneAPIService {
  private baseURL: string;
  private timeout: number;

  constructor(baseURL?: string, timeout: number = 30000) {
    // 从环境变量获取 one-api 地址，默认使用 docker-compose 内部地址
    // 在服务端使用环境变量，客户端使用传入的 baseURL
    const defaultURL =
      typeof window === 'undefined'
        ? ((globalThis as any).process?.env?.ONEAPI_BASE_URL as string | undefined) ||
          'http://one-api:3000'
        : 'http://localhost:3000';
    this.baseURL = baseURL || defaultURL;
    this.timeout = timeout;
  }

  /**
   * 通用请求方法
   */
  private async request<T>(
    endpoint: string,
    options: Record<string, any> = {},
    token?: string,
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }

      throw new Error('Unknown error occurred');
    }
  }

  /**
   * 用户注册
   * @param data 注册数据
   * @returns 注册结果
   */
  async register(data: RegisterData): Promise<RegisterResult> {
    return this.request<RegisterResult>('/api/user/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * 用户登录
   * @param username 用户名
   * @param password 密码
   * @returns 登录结果（包含 token）
   */
  async login(username: string, password: string): Promise<LoginResult> {
    return this.request<LoginResult>('/api/user/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  /**
   * 获取用户信息（包含余额）
   * @param token OneAPI Token
   * @returns 用户信息
   */
  async getUserInfo(token: string): Promise<UserInfo> {
    return this.request<UserInfo>('/api/user/self', {
      method: 'GET',
    }, token);
  }

  /**
   * 创建充值订单
   * @param token OneAPI Token
   * @param amount 充值金额（元）
   * @returns 充值订单信息
   */
  async createTopup(token: string, amount: number): Promise<TopupOrder> {
    return this.request<TopupOrder>('/api/topup', {
      method: 'POST',
      body: JSON.stringify({ amount: Math.round(amount * 1000) }), // 转换为分
    }, token);
  }

  /**
   * 获取充值历史
   * @param token OneAPI Token
   * @param page 页码（从0开始）
   * @param pageSize 每页数量
   * @returns 充值历史
   */
  async getTopupHistory(
    token: string,
    page: number = 0,
    pageSize: number = 20,
  ): Promise<TopupHistoryResult> {
    return this.request<TopupHistoryResult>(
      `/api/topup?p=${page}&page_size=${pageSize}`,
      {
        method: 'GET',
      },
      token,
    );
  }

  /**
   * 获取使用日志
   * @param token OneAPI Token
   * @param page 页码（从0开始）
   * @param pageSize 每页数量
   * @returns 使用日志
   */
  async getLogs(token: string, page: number = 0, pageSize: number = 20): Promise<LogsResult> {
    return this.request<LogsResult>(
      `/api/log?p=${page}&page_size=${pageSize}`,
      {
        method: 'GET',
      },
      token,
    );
  }

  /**
   * 获取统计数据
   * @param token OneAPI Token
   * @param startTime 开始时间戳（秒）
   * @param endTime 结束时间戳（秒）
   * @returns 统计数据
   */
  async getStatistics(token: string, startTime: number, endTime: number): Promise<Statistics> {
    return this.request<Statistics>(
      `/api/log/stat?start_timestamp=${startTime}&end_timestamp=${endTime}`,
      {
        method: 'GET',
      },
      token,
    );
  }
}

// 导出单例实例
export const oneAPIService = new OneAPIService();
