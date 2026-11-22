# Windows 標準の OCR(日本語)で、フォルダ内の PNG を文字に起こす
# 出力: 同じフォルダに <画像名>.ocr.json (行ごとの単語と位置)
# 使い方: powershell -File scripts/extract/ocr.ps1 <フォルダ>
param([Parameter(Mandatory = $true)][string]$Dir)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  })[0]
function Await($op, [Type]$type) {
  $task = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  $task.Result
}

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('ja'))
if ($null -eq $engine) { throw '日本語の OCR エンジンを作れませんでした' }

$full = (Resolve-Path $Dir).Path
foreach ($png in Get-ChildItem -Path $full -Filter *.png | Sort-Object Name) {
  $out = Join-Path $full ($png.BaseName + '.ocr.json')
  if (Test-Path $out) { continue }
  $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($png.FullName)) ([Windows.Storage.StorageFile])
  $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  $lines = @()
  foreach ($line in $result.Lines) {
    $words = @()
    foreach ($w in $line.Words) {
      $r = $w.BoundingRect
      $words += [pscustomobject]@{ t = $w.Text; x = [math]::Round($r.X, 1); y = [math]::Round($r.Y, 1); w = [math]::Round($r.Width, 1); h = [math]::Round($r.Height, 1) }
    }
    $lines += [pscustomobject]@{ words = $words }
  }
  $json = [pscustomobject]@{ width = $bitmap.PixelWidth; height = $bitmap.PixelHeight; lines = $lines } | ConvertTo-Json -Depth 6 -Compress
  [IO.File]::WriteAllText($out, $json, (New-Object Text.UTF8Encoding $false))
  $stream.Dispose()
  Write-Output "$($png.Name): $($lines.Count) lines"
}
