# build.ps1 - 一键编译所有平台（输出到 dist/）
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deno API Router - 跨平台编译" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$OutputDir = "dist"

# 创建输出目录
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$targets = @(
    @{ Name = "Windows x64"; Target = "x86_64-pc-windows-msvc"; Output = "$OutputDir/api-router-win.exe" },
    @{ Name = "Linux x64"; Target = "x86_64-unknown-linux-gnu"; Output = "$OutputDir/api-router-linux" },
    @{ Name = "macOS Intel"; Target = "x86_64-apple-darwin"; Output = "$OutputDir/api-router-macos-intel" },
    @{ Name = "macOS ARM"; Target = "aarch64-apple-darwin"; Output = "$OutputDir/api-router-macos-arm" }
)

foreach ($t in $targets) {
    Write-Host "[编译] $($t.Name) -> $($t.Output)" -ForegroundColor Blue
    deno compile --bundle --minify --allow-net --allow-env --allow-read --allow-write --output $t.Output --no-check --target $t.Target src/main.ts
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ 编译成功" -ForegroundColor Green
    } else {
        Write-Host "  ❌ 编译失败" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  所有平台编译完成！" -ForegroundColor Green
Write-Host "  输出目录: $OutputDir/" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Cyan
