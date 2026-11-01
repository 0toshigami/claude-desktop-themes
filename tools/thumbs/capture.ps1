# Built-in wallpapers: capture.ps1 <id>... (from thumb-<id>.html). One page: capture.ps1 -Page <page.html> -Out <file.jpg>
[CmdletBinding(PositionalBinding = $false)]
param([string]$Page, [string]$Out, [Parameter(ValueFromRemainingArguments)][string[]]$Ids)
if ($Page) { Remove-Item $Out -ErrorAction SilentlyContinue } # (first: no picture beats an old one of another scene)
Add-Type -AssemblyName System.Drawing
$here = $PSScriptRoot
$browser = @($env:THUMB_BROWSER) + (@(${env:ProgramFiles(x86)}, $env:ProgramFiles, $env:LOCALAPPDATA) | ForEach-Object {
  "$_\Microsoft\Edge\Application\msedge.exe", "$_\Google\Chrome\Application\chrome.exe",
  "$_\BraveSoftware\Brave-Browser\Application\brave.exe", "$_\Chromium\Application\chrome.exe"
}) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $browser) { throw 'No Chromium browser found (Edge, Chrome, Brave or Chromium). Set THUMB_BROWSER to one.' }
$jpeg = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$q = New-Object Drawing.Imaging.EncoderParameters 1
$q.Param[0] = New-Object Drawing.Imaging.EncoderParameter ([Drawing.Imaging.Encoder]::Quality), 78L
$jobs = @(if ($Page) { ,@((Resolve-Path $Page).Path, [IO.Path]::GetFullPath($Out)) } else { $Ids | ForEach-Object { ,@("$here\thumb-$_.html", "$here\$_.jpg") } })
foreach ($job in $jobs) {
  $page, $jpg = $job; $id = [IO.Path]::GetFileNameWithoutExtension($jpg)
  $png = [IO.Path]::ChangeExtension($jpg, '.png')
  Remove-Item $png -ErrorAction SilentlyContinue
  & $browser --headless=new --disable-gpu --hide-scrollbars --window-size=1200,700 --virtual-time-budget=3000 "--screenshot=$png" ([Uri]$page).AbsoluteUri 2>$null | Out-Null
  if (-not (Test-Path $png)) { "${id}: no shot"; continue }
  $src = [Drawing.Image]::FromFile($png)
  $dst = New-Object Drawing.Bitmap 240, 140
  $g = [Drawing.Graphics]::FromImage($dst)
  $g.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($src, 0, 0, 240, 140)
  $g.Dispose(); $src.Dispose()
  $dst.Save($jpg, $jpeg, $q); $dst.Dispose()
  if ($Page) { Remove-Item $png }
  "${id}: $((Get-Item $jpg).Length) bytes"
}
