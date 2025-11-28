# OneAPI Service

封装所有 one-api API 调用的服务类。

## 文件结构

```
oneapi/
├── index.ts          # OneAPIService 主类
├── types.ts          # TypeScript 类型定义
├── index.test.ts     # 单元测试
└── README.md         # 本文档
```

## 使用方法

### 导入服务

```typescript
import { oneAPIService } from '@/services/oneapi';
```

### 用户注册

```typescript
const result = await oneAPIService.register({
  username: 'testuser',
  password: 'password123',
  email: 'test@example.com',
});
```

### 用户登录

```typescript
const result = await oneAPIService.login('testuser', 'password123');
const token = result.data?.token;
```

### 获取用户信息（包含余额）

```typescript
const userInfo = await oneAPIService.getUserInfo(token);
console.log(`余额: ${userInfo.quota / 1000} 元`);
```

### 创建充值订单

```typescript
const order = await oneAPIService.createTopup(token, 100); // 充值100元
window.open(order.data?.payment_url, '_blank');
```

### 获取充值历史

```typescript
const history = await oneAPIService.getTopupHistory(token, 0, 20);
```

### 获取使用日志

```typescript
const logs = await oneAPIService.getLogs(token, 0, 20);
```

### 获取统计数据

```typescript
const startTime = Math.floor(Date.now() / 1000) - 86400 * 30; // 30天前
const endTime = Math.floor(Date.now() / 1000);
const stats = await oneAPIService.getStatistics(token, startTime, endTime);
```

## 配置

### 环境变量

在 `.env` 文件中配置 one-api 地址：

```env
ONEAPI_BASE_URL=http://one-api:3000
```

如果未配置，默认使用 `http://one-api:3000`（docker-compose 内部地址）。

### 超时设置

默认超时时间为 30 秒。可以在创建实例时自定义：

```typescript
const customService = new OneAPIService('http://custom-url:3000', 5000); // 5秒超时
```

## 错误处理

所有方法都会抛出错误，需要使用 try-catch 捕获：

```typescript
try {
  const result = await oneAPIService.register(data);
} catch (error) {
  console.error('注册失败:', error.message);
}
```

常见错误：
- `Request timeout`: 请求超时
- `Invalid credentials`: 登录凭证无效
- `Username already exists`: 用户名已存在
- `Invalid token`: Token 无效或已过期

## 单位转换

### 余额单位

one-api 使用"分"作为单位（1元 = 1000分）：

- **显示余额**: `quota / 1000` 元
- **充值金额**: `amount * 1000` 分

### 时间戳

one-api 使用秒级时间戳：

- **JavaScript**: `Math.floor(Date.now() / 1000)`
- **显示时间**: `new Date(timestamp * 1000)`

## 测试

运行单元测试：

```bash
pnpm test src/services/oneapi/index.test.ts --run
```

测试覆盖：
- ✅ 用户注册
- ✅ 用户登录
- ✅ 获取用户信息
- ✅ 创建充值订单
- ✅ 获取充值历史
- ✅ 获取使用日志
- ✅ 获取统计数据
- ✅ 错误处理（超时、网络错误、认证失败）

## API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| register | POST /api/user/register | 用户注册 |
| login | POST /api/user/login | 用户登录 |
| getUserInfo | GET /api/user/self | 获取用户信息 |
| createTopup | POST /api/topup | 创建充值订单 |
| getTopupHistory | GET /api/topup | 获取充值历史 |
| getLogs | GET /api/log | 获取使用日志 |
| getStatistics | GET /api/log/stat | 获取统计数据 |

## 下一步

- [ ] 实现用户注册 API（任务 3）
- [ ] 实现余额显示组件（任务 4）
- [ ] 实现充值功能组件（任务 5）
- [ ] 实现使用统计组件（任务 6）
- [ ] 实现消费记录组件（任务 7）
