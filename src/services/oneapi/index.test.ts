import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OneAPIService } from './index';
import type {
  LoginResult,
  LogsResult,
  RegisterResult,
  Statistics,
  TopupHistoryResult,
  TopupOrder,
  UserInfo,
} from './types';

// Mock fetch globally
global.fetch = vi.fn();

describe('OneAPIService', () => {
  let service: OneAPIService;
  const mockBaseURL = 'http://test-oneapi:3000';
  const mockToken = 'test-token-123';

  beforeEach(() => {
    service = new OneAPIService({ baseURL: mockBaseURL, timeout: 5000 });
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a user', async () => {
      const mockResponse: RegisterResult = {
        success: true,
        message: 'Registration successful',
        data: {
          id: 1,
          username: 'testuser',
          token: 'new-token-123',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.register({
        username: 'testuser',
        password: 'password123',
        email: 'test@example.com',
      });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseURL}/api/user/register`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('should handle registration errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Username already exists' }),
      });

      await expect(
        service.register({
          username: 'existinguser',
          password: 'password123',
        }),
      ).rejects.toThrow('Username already exists');
    });
  });

  describe('login', () => {
    it('should successfully login a user', async () => {
      const mockResponse: LoginResult = {
        success: true,
        message: 'Login successful',
        data: {
          id: 1,
          username: 'testuser',
          token: mockToken,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.login('testuser', 'password123');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseURL}/api/user/login`,
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('should handle login errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Invalid credentials' }),
      });

      await expect(service.login('testuser', 'wrongpassword')).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('getUserInfo', () => {
    it('should successfully get user info', async () => {
      const mockResponse: UserInfo = {
        id: 1,
        username: 'testuser',
        display_name: 'Test User',
        email: 'test@example.com',
        role: 1,
        status: 1,
        quota: 100000, // 100元 * 1000
        used_quota: 50000,
        request_count: 100,
        group: 'default',
        created_time: Date.now(),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.getUserInfo(mockToken);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseURL}/api/user/self`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        }),
      );
    });

    it('should handle unauthorized access', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Invalid token' }),
      });

      await expect(service.getUserInfo('invalid-token')).rejects.toThrow('Invalid token');
    });
  });

  describe('createTopup', () => {
    it('should successfully create a topup order', async () => {
      const mockResponse: TopupOrder = {
        success: true,
        message: 'Topup order created',
        data: {
          trade_no: 'TRADE123456',
          payment_url: 'https://payment.example.com/pay/TRADE123456',
          amount: 100000, // 100元 * 1000
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.createTopup(mockToken, 100);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseURL}/api/topup`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ amount: 100000 }), // 100元转换为100000分
        }),
      );
    });

    it('should convert yuan to fen correctly', async () => {
      const mockResponse: TopupOrder = {
        success: true,
        message: 'Topup order created',
        data: {
          trade_no: 'TRADE123456',
          payment_url: 'https://payment.example.com/pay/TRADE123456',
          amount: 50500, // 50.5元 * 1000
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await service.createTopup(mockToken, 50.5);

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseURL}/api/topup`,
        expect.objectContaining({
          body: JSON.stringify({ amount: 50500 }),
        }),
      );
    });
  });

  describe('getTopupHistory', () => {
    it('should successfully get topup history', async () => {
      const mockResponse: TopupHistoryResult = {
        success: true,
        message: 'Success',
        data: [
          {
            id: 1,
            user_id: 1,
            amount: 100000,
            status: 1,
            trade_no: 'TRADE123456',
            created_time: Date.now(),
          },
        ],
        total: 1,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.getTopupHistory(mockToken, 0, 20);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseURL}/api/topup?p=0&page_size=20`,
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });
  });

  describe('getLogs', () => {
    it('should successfully get usage logs', async () => {
      const mockResponse: LogsResult = {
        success: true,
        message: 'Success',
        data: [
          {
            id: 1,
            user_id: 1,
            created_at: Date.now(),
            type: 1,
            content: 'API call',
            username: 'testuser',
            token_name: 'default',
            model_name: 'gpt-3.5-turbo',
            quota: 100,
            prompt_tokens: 50,
            completion_tokens: 50,
            channel: 'openai',
          },
        ],
        total: 1,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.getLogs(mockToken, 0, 20);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseURL}/api/log?p=0&page_size=20`,
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });
  });

  describe('getStatistics', () => {
    it('should successfully get statistics', async () => {
      const startTime = Math.floor(Date.now() / 1000) - 86400 * 30; // 30 days ago
      const endTime = Math.floor(Date.now() / 1000);

      const mockResponse: Statistics = {
        success: true,
        message: 'Success',
        data: [
          {
            date: '2024-01-01',
            request_count: 100,
            quota: 10000,
          },
          {
            date: '2024-01-02',
            request_count: 150,
            quota: 15000,
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.getStatistics(mockToken, startTime, endTime);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseURL}/api/log/stat?start_timestamp=${startTime}&end_timestamp=${endTime}`,
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should handle network timeout', async () => {
      const shortTimeoutService = new OneAPIService({ baseURL: mockBaseURL, timeout: 100 });

      (global.fetch as any).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ ok: true, json: async () => ({}) }), 200);
          }),
      );

      await expect(
        shortTimeoutService.register({
          username: 'testuser',
          password: 'password123',
        }),
      ).rejects.toThrow('Request timeout');
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        service.register({
          username: 'testuser',
          password: 'password123',
        }),
      ).rejects.toThrow('Network error');
    });

    it('should handle unknown errors', async () => {
      (global.fetch as any).mockRejectedValueOnce('Unknown error');

      await expect(
        service.register({
          username: 'testuser',
          password: 'password123',
        }),
      ).rejects.toThrow('Unknown error occurred');
    });
  });
});
