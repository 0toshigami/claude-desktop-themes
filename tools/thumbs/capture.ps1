# Captures each live wallpaper's page (thumb-<id>.html here, from pages.ts) with a headless Chromium browser at
# 1200x700, then shrinks it to a 360x210 JPEG for the theme strip's tile: capture.ps1 <id> <id> ...
# The browser: $env:THUMB_BROWSER if set, else the first of Edge, Chrome, Brave and Chromium found where they install.
# Without one, nothing breaks: a live wallpaper with no capture shows its drawn preview in the strip.
param([Parameter(ValueFromRemainingArguments)][string[]]$Ids)
Add-Type -AssemblyName System.Drawing
$here = $PSScriptRoot
$browser = @($env:THUMB_BROWSER) + (@(${env:ProgramFiles(x86)}, $env:ProgramFiles, $env:LOCALAPPDATA) | ForEach-Object {
  "$_\Microsoft\Edge\Application\msedge.exe", "$_\Google\Chrome\Application\chrome.exe",
  "$_\BraveSoftware\Brave-Browser\Application\brave.exe", "$_\Chromium\Application\chrome.exe"
}) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $browser) { throw 'No Chromium browser found (Edge, Chrome, Brave or Chromium). Set THUMB_BROWSER to one.' }
$jpeg = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$q = New-Object Drawing.Imaging.EncoderParameters 1
$q.Param[0] = New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality), 82L
foreach ($id in $Ids) {
  $png = "$here\$id.png"
  Remove-Item $png -ErrorAction SilentlyContinue # (a stale shot misleads)
  & $browser --headless=new --disable-gpu --hide-scrollbars --window-size=1200,700 --virtual-time-budget=3000 "--screenshot=$png" ([Uri]"$here\thumb-$id.html").AbsoluteUri 2>$null | Out-Null
  if (-not (Test-Path $png)) { "${id}: no shot"; continue }
  $src = [Drawing.Image]::FromFile($png)
  $dst = New-Object Drawing.Bitmap 360, 210
  $g = [Drawing.Graphics]::FromImage($dst)
  $g.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($src, 0, 0, 360, 210)
  $g.Dispose(); $src.Dispose()
  $dst.Save("$here\$id.jpg", $jpeg, $q); $dst.Dispose()
  "${id}: $((Get-Item "$here\$id.jpg").Length) bytes"
}
