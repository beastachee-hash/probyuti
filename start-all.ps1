$site = 'G:\Cline\probyuti-site'
$cf   = 'G:\Cline\cloudflared.exe'

# Node-сервер сайта (порт 80)
if (-not (Get-NetTCPConnection -LocalPort 80 -State Listen -ErrorAction SilentlyContinue)) {
    $env:PORT = '80'
    $env:NODE_ENV = 'production'
    Start-Process node -ArgumentList 'server.js' -WorkingDirectory $site -WindowStyle Hidden
}

# Cloudflare-тоннель (http2 — стабильно на сетях, где режут UDP)
if (-not (Get-Process cloudflared -ErrorAction SilentlyContinue)) {
    Start-Process $cf -ArgumentList @('--protocol','http2','tunnel','run','probyuti') -WindowStyle Hidden
}
