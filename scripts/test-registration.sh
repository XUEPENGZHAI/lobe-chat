#!/bin/bash
# ============================================
# Registration Integration Test Script
# 注册流程集成测试脚本
# ============================================
#
# 使用方法:
# 1. 确保 Docker 环境已启动: docker-compose up -d
# 2. 运行此脚本: ./scripts/test-registration.sh
#
# 或者使用 docker-compose:
# docker-compose --profile test run --rm lobe-chat-test ./scripts/test-registration.sh
# ============================================

set -e

echo "============================================"
echo "Registration Integration Test"
echo "============================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
ONEAPI_URL="${ONEAPI_BASE_URL:-http://one-api:3000}"
MAX_RETRIES=30
RETRY_INTERVAL=2

# 等待服务就绪
wait_for_service() {
    local url=$1
    local name=$2
    local retries=0

    echo -e "${YELLOW}Waiting for $name to be ready...${NC}"

    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|301\|302"; then
            echo -e "${GREEN}$name is ready!${NC}"
            return 0
        fi
        retries=$((retries + 1))
        echo "  Attempt $retries/$MAX_RETRIES..."
        sleep $RETRY_INTERVAL
    done

    echo -e "${RED}$name did not become ready in time${NC}"
    return 1
}

# 测试 one-api 注册
test_oneapi_registration() {
    # Note: one-api has username max=12, password min=8 max=20
    local username="tu$RANDOM"
    local email="test$RANDOM@example.com"
    local password="TestPass123!"

    echo ""
    echo -e "${YELLOW}Test 1: one-api User Registration${NC}"
    echo "  Username: $username"
    echo "  Email: $email"

    local response=$(curl -s -X POST "$ONEAPI_URL/api/user/register" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$username\",\"password\":\"$password\",\"email\":\"$email\"}")

    echo "  Response: $response"

    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}  ✓ Registration successful${NC}"

        # 提取用户 ID
        local user_id=$(echo "$response" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
        echo "  User ID: $user_id"

        # 测试登录
        echo ""
        echo -e "${YELLOW}Test 2: one-api User Login${NC}"
        local login_response=$(curl -s -X POST "$ONEAPI_URL/api/user/login" \
            -H "Content-Type: application/json" \
            -d "{\"username\":\"$username\",\"password\":\"$password\"}")

        echo "  Response: $login_response"

        if echo "$login_response" | grep -q '"success":true'; then
            echo -e "${GREEN}  ✓ Login successful${NC}"

            # 提取 token
            local token=$(echo "$login_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
            if [ -n "$token" ]; then
                echo "  Token obtained: ${token:0:20}..."

                # 测试获取用户信息
                echo ""
                echo -e "${YELLOW}Test 3: Get User Info${NC}"
                local user_info=$(curl -s -X GET "$ONEAPI_URL/api/user/self" \
                    -H "Authorization: Bearer $token")

                echo "  Response: $user_info"

                if echo "$user_info" | grep -q "$username"; then
                    echo -e "${GREEN}  ✓ User info retrieved successfully${NC}"
                else
                    echo -e "${RED}  ✗ Failed to get user info${NC}"
                    return 1
                fi
            fi
        else
            echo -e "${RED}  ✗ Login failed${NC}"
            return 1
        fi

        return 0
    else
        echo -e "${RED}  ✗ Registration failed${NC}"
        return 1
    fi
}

# 测试重复注册（应该失败）
test_duplicate_registration() {
    # Note: one-api has username max=12, password min=8 max=20
    local username="dup$RANDOM"
    local email="dup$RANDOM@example.com"
    local password="TestPass123!"

    echo ""
    echo -e "${YELLOW}Test 4: Duplicate Registration (should fail)${NC}"

    # 第一次注册
    curl -s -X POST "$ONEAPI_URL/api/user/register" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$username\",\"password\":\"$password\",\"email\":\"$email\"}" > /dev/null

    # 第二次注册（应该失败）
    local response=$(curl -s -X POST "$ONEAPI_URL/api/user/register" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$username\",\"password\":\"$password\",\"email\":\"$email\"}")

    echo "  Response: $response"

    if echo "$response" | grep -q '"success":false'; then
        echo -e "${GREEN}  ✓ Duplicate registration correctly rejected${NC}"
        return 0
    else
        echo -e "${RED}  ✗ Duplicate registration was not rejected${NC}"
        return 1
    fi
}

# 测试无效登录
test_invalid_login() {
    echo ""
    echo -e "${YELLOW}Test 5: Invalid Login (should fail)${NC}"

    local response=$(curl -s -X POST "$ONEAPI_URL/api/user/login" \
        -H "Content-Type: application/json" \
        -d '{"username":"nonexistent_user_xyz","password":"wrongpassword"}')

    echo "  Response: $response"

    if echo "$response" | grep -q '"success":false'; then
        echo -e "${GREEN}  ✓ Invalid login correctly rejected${NC}"
        return 0
    else
        echo -e "${RED}  ✗ Invalid login was not rejected${NC}"
        return 1
    fi
}

# 主函数
main() {
    local failed=0

    # 等待 one-api 服务就绪
    wait_for_service "$ONEAPI_URL/api/status" "one-api" || exit 1

    echo ""
    echo "============================================"
    echo "Running Integration Tests"
    echo "============================================"

    # 运行测试
    test_oneapi_registration || failed=$((failed + 1))
    test_duplicate_registration || failed=$((failed + 1))
    test_invalid_login || failed=$((failed + 1))

    echo ""
    echo "============================================"
    echo "Test Summary"
    echo "============================================"

    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}$failed test(s) failed${NC}"
        exit 1
    fi
}

main "$@"
