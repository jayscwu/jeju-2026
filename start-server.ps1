$ErrorActionPreference = "Stop"

$port = 4173
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$hostName = "127.0.0.1"
$url = "http://$hostName`:$port/"

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host ""
Write-Host "Starting Jeju 2026 local server..." -ForegroundColor Yellow
Write-Host "Folder: $root"
Write-Host "URL: $url"
Write-Host ""

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".webmanifest" = "application/manifest+json; charset=utf-8"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".svg" = "image/svg+xml"
  ".ico" = "image/x-icon"
}

function Get-SafePath {
  param([string]$UrlPath)

  $path = $UrlPath.Split("?")[0].TrimStart("/")
  $decoded = [System.Uri]::UnescapeDataString($path)
  if ([string]::IsNullOrWhiteSpace($decoded)) {
    $decoded = "index.html"
  }

  $candidate = Join-Path $root $decoded
  $fullPath = [System.IO.Path]::GetFullPath($candidate)
  $fullRoot = [System.IO.Path]::GetFullPath($root)

  if (-not $fullPath.StartsWith($fullRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }

  return $fullPath
}

function Write-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [string]$ContentType,
    [byte[]]$Body
  )

  $header = "HTTP/1.1 $StatusCode $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
}

$listener = $null

try {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse($hostName), $port)
  $listener.Start()
  Write-Host ""
  Write-Host "Jeju 2026 Web App server is running:" -ForegroundColor Green
  Write-Host $url -ForegroundColor Cyan
  Write-Host ""
  Write-Host "Keep this PowerShell window open. Press Ctrl + C to stop."
  Write-Host ""

  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII)
      $requestLine = $reader.ReadLine()

      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        $client.Close()
        continue
      }

      $parts = $requestLine.Split(" ")
      $requestPath = if ($parts.Length -ge 2) { $parts[1] } else { "/" }

      while ($reader.Peek() -ge 0) {
        $line = $reader.ReadLine()
        if ([string]::IsNullOrEmpty($line)) {
          break
        }
      }

      $filePath = Get-SafePath $requestPath
      if ($null -eq $filePath -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
        Write-Response $stream 404 "Not Found" "text/plain; charset=utf-8" $body
        continue
      }

      $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
      $contentType = "application/octet-stream"
      if ($mimeTypes.ContainsKey($extension)) {
        $contentType = $mimeTypes[$extension]
      }

      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      Write-Response $stream 200 "OK" $contentType $bytes
    }
    finally {
      $client.Close()
    }
  }
}
finally {
  if ($null -ne $listener) {
    $listener.Stop()
  }
}
