# Captures each live wallpaper's page (thumb-<id>.html here, from pages.ts) with headless Edge at 1200x700, then
# shrinks it to a 360x210 JPEG for the theme strip's tile: capture.ps1 <id> <id> ...
param([Parameter(ValueFromRemainingArguments)][string[]]$Ids)
Add-Type -AssemblyName System.Drawing
$here = $PSScriptRoot
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$jpeg = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$q = New-Object Drawing.Imaging.EncoderParameters 1
$q.Param[0] = New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality), 82L
foreach ($id in $Ids) {
  $png = "$here\$id.png"
  Remove-Item $png -ErrorAction SilentlyContinue # (a stale shot misleads)
  & $edge --headless=new --disable-gpu --hide-scrollbars --window-size=1200,700 --virtual-time-budget=3000 "--screenshot=$png" ([Uri]"$here\thumb-$id.html").AbsoluteUri 2>$null | Out-Null
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
