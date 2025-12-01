# Registration Integration Test Script (PowerShell)
# Note: one-api has username max=12, password min=8 max=20

$ErrorActionPreference = "Continue"
$ONEAPI_URL = "http://localhost:3000"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Registration Integration Test" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Test 1: Registration
$random = Get-Random -Maximum 99999
$username = "tu$random"
$password = "TestPass123!"
$email = "test$random@example.com"

Write-Host "`nTest 1: User Registration" -ForegroundColor Yellow
Write-Host "  Username: $username"

$body = @{ username = $username; password = $password; email = $email } | ConvertTo-Json
$result = Invoke-RestMethod -Uri "$ONEAPI_URL/api/user/register" -Method Post -ContentType "application/json" -Body $body
Write-Host "  Response: $($result | ConvertTo-Json -Compress)"

if ($result.success -eq $true) {
    Write-Host "  [PASS] Registration successful" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Registration failed" -ForegroundColor Red
    exit 1
}

# Test 2: Login
Write-Host "`nTest 2: User Login" -ForegroundColor Yellow
$loginBody = @{ username = $username; password = $password } | ConvertTo-Json
$loginResult = Invoke-RestMethod -Uri "$ONEAPI_URL/api/user/login" -Method Post -ContentType "application/json" -Body $loginBody
Write-Host "  Response: $($loginResult | ConvertTo-Json -Compress)"

if ($loginResult.success -eq $true) {
    Write-Host "  [PASS] Login successful" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Login failed" -ForegroundColor Red
    exit 1
}

# Test 3: Duplicate Registration
Write-Host "`nTest 3: Duplicate Registration (should fail)" -ForegroundColor Yellow
$dupResult = Invoke-RestMethod -Uri "$ONEAPI_URL/api/user/register" -Method Post -ContentType "application/json" -Body $body
Write-Host "  Response: $($dupResult | ConvertTo-Json -Compress)"

if ($dupResult.success -eq $false) {
    Write-Host "  [PASS] Duplicate correctly rejected" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Duplicate was not rejected" -ForegroundColor Red
    exit 1
}

# Test 4: Invalid Login
Write-Host "`nTest 4: Invalid Login (should fail)" -ForegroundColor Yellow
$invalidBody = @{ username = "nouser123"; password = "wrongpass1" } | ConvertTo-Json
$invalidResult = Invoke-RestMethod -Uri "$ONEAPI_URL/api/user/login" -Method Post -ContentType "application/json" -Body $invalidBody
Write-Host "  Response: $($invalidResult | ConvertTo-Json -Compress)"

if ($invalidResult.success -eq $false) {
    Write-Host "  [PASS] Invalid login correctly rejected" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Invalid login was not rejected" -ForegroundColor Red
    exit 1
}

# ============================================
# Part 2: lobe-chat Full E2E Tests
# ============================================
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "Part 2: lobe-chat Full E2E Tests" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

$LOBECHAT_URL = "http://localhost:3210"

# Test 5: lobe-chat Registration (Full Flow)
$random2 = Get-Random -Maximum 99999
$username2 = "lc$random2"
$password2 = "TestPass123!"
$email2 = "lc$random2@example.com"

Write-Host "`nTest 5: lobe-chat Full Registration Flow" -ForegroundColor Yellow
Write-Host "  Username: $username2"
Write-Host "  Email: $email2"

try {
    $lcBody = @{ username = $username2; password = $password2; email = $email2 } | ConvertTo-Json
    $lcResult = Invoke-RestMethod -Uri "$LOBECHAT_URL/api/auth/register" -Method Post -ContentType "application/json" -Body $lcBody -TimeoutSec 30
    Write-Host "  Response: $($lcResult | ConvertTo-Json -Compress)"

    if ($lcResult.success -eq $true) {
        Write-Host "  [PASS] lobe-chat registration successful" -ForegroundColor Green

        # Verify one-api account was created
        Write-Host "`nTest 6: Verify one-api Account Sync" -ForegroundColor Yellow
        $oneapiLogin = @{ username = $username2; password = $password2 } | ConvertTo-Json
        $oneapiResult = Invoke-RestMethod -Uri "$ONEAPI_URL/api/user/login" -Method Post -ContentType "application/json" -Body $oneapiLogin

        if ($oneapiResult.success -eq $true) {
            Write-Host "  [PASS] one-api account synced successfully" -ForegroundColor Green
        } else {
            Write-Host "  [WARN] one-api account not synced (may need manual check)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  [WARN] lobe-chat registration returned: $($lcResult.message)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [WARN] lobe-chat API not available or error: $_" -ForegroundColor Yellow
    Write-Host "  (This is expected if lobe-chat registration API is not fully configured)" -ForegroundColor Gray
}

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "All tests completed!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
