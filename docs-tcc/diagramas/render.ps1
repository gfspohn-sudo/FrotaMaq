$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

$names = @(
  '01_diagrama_casos_de_uso',
  '02_diagrama_sequencia',
  '03_diagrama_classes',
  '04_diagrama_atividade',
  '05_diagrama_banco_er'
)

foreach ($name in $names) {
  $inputFile = Join-Path $here "$name.mmd"
  foreach ($ext in @('png', 'svg')) {
    $outFile = Join-Path $here "$name.$ext"
    Write-Host "Rendering $name.$ext"
    & npx -y @mermaid-js/mermaid-cli@11.4.2 -i $inputFile -o $outFile -b white -s 2 -w 2800 --configFile (Join-Path $here 'mermaid-config.json') --puppeteerConfigFile (Join-Path $here 'puppeteer.json')
    if ($LASTEXITCODE -ne 0) { throw "mmdc failed for $name.$ext" }
  }
}

Write-Host 'Done'
