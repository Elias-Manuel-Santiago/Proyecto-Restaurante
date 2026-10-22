$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$layout = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'diagrama-clases-mercadopago.json') -Raw -Encoding utf8 | ConvertFrom-Json
$bitmap = [System.Drawing.Bitmap]::new(($layout.width * 2),($layout.height * 2))
$g = [System.Drawing.Graphics]::FromImage($bitmap)
$g.ScaleTransform(2,2)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#f5f7fb'))
$ink = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#172033'))
$title = [System.Drawing.Font]::new('Segoe UI',21,[System.Drawing.FontStyle]::Bold)
$heading = [System.Drawing.Font]::new('Segoe UI',14.25,[System.Drawing.FontStyle]::Bold)
$font = [System.Drawing.Font]::new('Consolas',9.75)
$small = [System.Drawing.Font]::new('Segoe UI',9)
$note = [System.Drawing.Font]::new('Segoe UI',10.5)
$pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#475569'),2)
try {
  $g.DrawString('NÁCAR · Integración con Mercado Pago',$title,$ink,40,15)
  $g.DrawString('Diagrama UML de contratos, módulos y objetos · Implementación actual · 22/10/2026',$note,$ink,40,56)
  $g.DrawString('React → Axios → rutas Express /api/pagos/:id → lógica de pagos → adaptador → API Mercado Pago',$note,$ink,40,86)
  foreach ($property in $layout.tables.PSObject.Properties) {
    $name=$property.Name; $t=$property.Value; $x=[single]$t.x; $y=[single]$t.y
    $color=if ($name -eq 'PasarelaPago') {'#6d28d9'} elseif ($name -in @('Pedido','Pago')) {'#0f766e'} else {'#244769'}
    $brush=[System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($color))
    $g.FillRectangle([System.Drawing.Brushes]::White,$x,$y,[single]$t.w,[single]$t.h)
    $g.DrawRectangle($pen,$x,$y,[single]$t.w,[single]$t.h)
    $g.FillRectangle($brush,$x,$y,[single]$t.w,68)
    $g.DrawString(('«'+$t.kind+'»'),$small,[System.Drawing.Brushes]::White,$x+12,$y+7)
    $g.DrawString($name,$heading,[System.Drawing.Brushes]::White,$x+12,$y+27)
    $i=0
    foreach ($row in $t.rows) { $g.DrawString([string]$row,$font,$ink,$x+12,$y+78+$i*28); $i++ }
    $brush.Dispose()
  }
  foreach ($edge in $layout.edges) {
    $points=[System.Drawing.PointF[]]@($edge[3] | ForEach-Object { [System.Drawing.PointF]::new([single]$_[0],[single]$_[1]) })
    $pen.DashStyle=if ($edge[5] -eq 'association') {'Solid'} else {'Dash'}
    $pen.EndCap=if ($edge[5] -eq 'association') {'Flat'} else {'ArrowAnchor'}
    $g.DrawLines($pen,$points)
    if ($edge[5] -eq 'implements') {
      $a=$points[$points.Length-1]
      $tri=[System.Drawing.PointF[]]@([System.Drawing.PointF]::new($a.X,$a.Y),[System.Drawing.PointF]::new($a.X-9,$a.Y+16),[System.Drawing.PointF]::new($a.X+9,$a.Y+16))
      $g.FillPolygon([System.Drawing.Brushes]::White,$tri)
      $pen.DashStyle='Solid'; $pen.EndCap='Flat'; $g.DrawPolygon($pen,$tri)
    }
    $g.DrawString([string]$edge[2],$small,$ink,[single]$edge[4][0],[single]($edge[4][1]-15))
  }
  $i=0
  foreach ($text in $layout.notes) { $g.DrawString([string]$text,$note,$ink,40,(1340+$i*26)); $i++ }
  $bitmap.Save((Join-Path $PSScriptRoot 'diagrama-clases-mercadopago.png'),[System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $g.Dispose(); $bitmap.Dispose(); $ink.Dispose(); $title.Dispose(); $heading.Dispose(); $font.Dispose(); $small.Dispose(); $note.Dispose(); $pen.Dispose()
}
